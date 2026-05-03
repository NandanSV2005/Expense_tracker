import os
import sqlite3
import csv
from flask import Flask, request, jsonify, render_template, Response

app = Flask(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def _resolve_data_dir():
    """
    Try to use RENDER_DATA_DIR (persistent disk on Render paid plan).
    If it doesn't exist or isn't writable, fall back to the project directory.
    On Render free plan, /var/data is never mounted so we always fall back.
    """
    candidate = os.environ.get('RENDER_DATA_DIR', BASE_DIR)
    try:
        os.makedirs(candidate, exist_ok=True)
        # Quick write test to confirm the directory is actually usable
        test_path = os.path.join(candidate, '.write_test')
        with open(test_path, 'w') as f:
            f.write('ok')
        os.remove(test_path)
        return candidate
    except (PermissionError, OSError):
        # Fall back to project directory — always writable on Render
        return BASE_DIR

DATA_DIR = _resolve_data_dir()
DB_PATH = os.path.join(DATA_DIR, 'expense_tracker.db')


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create categories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            created_at DATETIME DEFAULT (DATETIME('now','localtime'))
        )
    """)
    
    # Create expenses table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL NOT NULL,
            description TEXT,
            category_id INTEGER NOT NULL,
            added_by TEXT NOT NULL,
            expense_date DATE DEFAULT (DATE('now','localtime')),
            created_at DATETIME DEFAULT (DATETIME('now','localtime')),
            FOREIGN KEY (category_id) REFERENCES categories (id)
        )
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_expense_date ON expenses(expense_date)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_category_id ON expenses(category_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_added_by ON expenses(added_by)")
    
    # Insert default categories
    default_categories = [
        'Groceries', 'Bills & Utilities', 'Rent / House Maintenance',
        'Travel', 'Health / Medical', 'Education', 'Shopping',
        'Entertainment', 'Savings / EMI', 'Miscellaneous'
    ]
    
    for category in default_categories:
        cursor.execute("INSERT OR IGNORE INTO categories (name) VALUES (?)", (category,))
        
    conn.commit()
    conn.close()

# Initialize DB on startup
init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/categories', methods=['GET'])
def get_categories():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM categories ORDER BY name ASC")
    categories = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(categories)

@app.route('/api/categories', methods=['POST'])
def add_category():
    data = request.json
    name = data.get('name', '').strip()
    
    if not name:
        return jsonify({'error': 'Category name is required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check for case-insensitive duplicate
    cursor.execute("SELECT id FROM categories WHERE LOWER(name) = LOWER(?)", (name,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Category already exists'}), 400
        
    try:
        cursor.execute("INSERT INTO categories (name) VALUES (?)", (name,))
        conn.commit()
        new_id = cursor.lastrowid
        conn.close()
        return jsonify({'id': new_id, 'name': name}), 201
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

def get_expenses_query(request_args):
    query = """
        SELECT e.id, e.amount, e.description, c.name as category_name, e.category_id, e.added_by, 
               e.expense_date, e.created_at
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        WHERE 1=1
    """
    params = []
    
    from_date = request_args.get('from_date')
    to_date = request_args.get('to_date')
    category_id = request_args.get('category_id')
    added_by = request_args.get('added_by')
    search = request_args.get('search')
    last_id = request_args.get('last_id')
    
    if from_date:
        query += " AND e.expense_date >= ?"
        params.append(from_date)
    if to_date:
        query += " AND e.expense_date <= ?"
        params.append(to_date)
    if category_id:
        query += " AND e.category_id = ?"
        params.append(category_id)
    if added_by and added_by != 'All':
        query += " AND e.added_by = ?"
        params.append(added_by)
    if search:
        query += " AND (e.description LIKE ? OR c.name LIKE ?)"
        search_term = f"%{search}%"
        params.extend([search_term, search_term])
    if last_id:
        query += " AND e.id > ?"
        params.append(last_id)
        
    query += " ORDER BY e.id DESC LIMIT 100"
    return query, params

@app.route('/api/expenses', methods=['GET'])
def get_expenses():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query, params = get_expenses_query(request.args)
    
    cursor.execute(query, tuple(params))
    expenses = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(expenses)

@app.route('/api/expenses', methods=['POST'])
def add_expense():
    data = request.json
    amount = data.get('amount')
    description = data.get('description', '')
    category_id = data.get('category_id')
    added_by = data.get('added_by')
    
    if not all([amount, category_id, added_by]):
        return jsonify({'error': 'Amount, category, and added_by are required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO expenses (amount, description, category_id, added_by) VALUES (?, ?, ?, ?)",
            (amount, description, category_id, added_by)
        )
        conn.commit()
        conn.close()
        return jsonify({'message': 'Expense added successfully'}), 201
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses/<int:expense_id>', methods=['PUT'])
def update_expense(expense_id):
    data = request.json
    amount = data.get('amount')
    description = data.get('description', '')
    category_id = data.get('category_id')
    added_by = data.get('added_by')
    
    if not all([amount, category_id, added_by]):
        return jsonify({'error': 'Amount, category, and added_by are required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE expenses SET amount = ?, description = ?, category_id = ?, added_by = ? WHERE id = ?",
            (amount, description, category_id, added_by, expense_id)
        )
        conn.commit()
        conn.close()
        return jsonify({'message': 'Expense updated successfully'}), 200
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/expenses/<int:expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM expenses WHERE id = ?", (expense_id,))
        conn.commit()
        conn.close()
        return jsonify({'message': 'Expense deleted successfully'}), 200
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/summary', methods=['GET'])
def get_summary():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # This Month
        cursor.execute("""
            SELECT SUM(amount) as total 
            FROM expenses 
            WHERE strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now', 'localtime')
        """)
        row = cursor.fetchone()
        this_month = row['total'] if row and row['total'] else 0
        
        # This Year
        cursor.execute("""
            SELECT SUM(amount) as total 
            FROM expenses 
            WHERE strftime('%Y', expense_date) = strftime('%Y', 'now', 'localtime')
        """)
        row = cursor.fetchone()
        this_year = row['total'] if row and row['total'] else 0
        
        # Overall
        cursor.execute("SELECT SUM(amount) as total FROM expenses")
        row = cursor.fetchone()
        overall = row['total'] if row and row['total'] else 0
        
        summary = {
            'this_month': float(this_month),
            'this_year': float(this_year),
            'overall': float(overall)
        }
        
        conn.close()
        return jsonify(summary)
    except sqlite3.Error as e:
        conn.close()
        return jsonify({'error': str(e)}), 500

@app.route('/api/export', methods=['GET'])
def export_csv():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # We use the same filter logic but remove the LIMIT 100
    query, params = get_expenses_query(request.args)
    query = query.replace(" LIMIT 100", "")
    
    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    conn.close()
    
    # Generate CSV content
    def generate():
        yield 'Date,Amount,Category,Added By,Description\n'
        for row in rows:
            # Escape quotes in description to avoid CSV breaking
            desc = str(row['description']).replace('"', '""') if row['description'] else ''
            yield f"{row['expense_date']},{row['amount']},\"{row['category_name']}\",\"{row['added_by']}\",\"{desc}\"\n"

    return Response(
        generate(),
        mimetype='text/csv',
        headers={"Content-Disposition": "attachment; filename=expenses_export.csv"}
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=False, host='0.0.0.0', port=port)
