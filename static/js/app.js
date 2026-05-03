document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const expenseTableBody = document.getElementById('expenseTableBody');
    const categorySelect = document.getElementById('category');
    const filterCategory = document.getElementById('filterCategory');
    const addExpenseForm = document.getElementById('addExpenseForm');
    const addExpenseModal = new bootstrap.Modal(document.getElementById('addExpenseModal'));
    const filterForm = document.getElementById('filterForm');
    
    // New Category Elements
    const newCategoryDiv = document.getElementById('newCategoryDiv');
    const newCategoryName = document.getElementById('newCategoryName');
    const btnSaveCategory = document.getElementById('btnSaveCategory');
    const newCategoryError = document.getElementById('newCategoryError');

    // Summary Elements
    const summaryMonth = document.getElementById('summary-month');
    const summaryYear = document.getElementById('summary-year');
    const summaryOverall = document.getElementById('summary-overall');
    const expenseCount = document.getElementById('expenseCount');

    // Category View Elements
    const categoryPills = document.getElementById('categoryPills');
    const categoryViewTitle = document.getElementById('categoryViewTitle');
    const categoryViewTotal = document.getElementById('categoryViewTotal');
    const categoryExpenseTableBody = document.getElementById('categoryExpenseTableBody');
    const editExpenseModal = new bootstrap.Modal(document.getElementById('editExpenseModal'));
    const editExpenseForm = document.getElementById('editExpenseForm');
    let selectedCategoryId = null;
    let allExpenses = []; // Local cache to help with editing

    // State
    let categories = [];
    let isPolling = true;

    // Initialization
    loadCategories();
    loadExpenses();
    loadSummary();

    // Set up polling (every 5 seconds)
    setInterval(() => {
        if (isPolling) {
            // Only poll if no filters are currently applied (or re-apply filters)
            // For simplicity, we just reload based on current filter state.
            loadExpenses(false); 
            loadSummary();
            
            // Reload the selected category if in Category View
            if (selectedCategoryId) {
                loadCategoryExpenses(selectedCategoryId, categoryViewTitle.textContent, false);
            }
        }
    }, 5000);

    // Fetch and populate categories
    async function loadCategories() {
        try {
            const res = await fetch('/api/categories');
            categories = await res.json();
            
            // Populate Add Expense Dropdown
            // Keep the default option and the "Add New" option
            let optionsHtml = '<option value="" disabled selected>Select a category...</option>';
            categories.forEach(cat => {
                optionsHtml += `<option value="${cat.id}">${cat.name}</option>`;
            });
            optionsHtml += '<option value="add_new" class="fw-bold text-primary">+ Add New Category</option>';
            categorySelect.innerHTML = optionsHtml;

            // Populate Filter Dropdown
            let filterHtml = '<option value="">All Categories</option>';
            categories.forEach(cat => {
                filterHtml += `<option value="${cat.id}">${cat.name}</option>`;
            });
            filterCategory.innerHTML = filterHtml;

            // Populate Edit Expense Dropdown
            let editOptionsHtml = '<option value="" disabled>Select a category...</option>';
            categories.forEach(cat => {
                editOptionsHtml += `<option value="${cat.id}">${cat.name}</option>`;
            });
            document.getElementById('editCategory').innerHTML = editOptionsHtml;
            
            // Populate Category Pills for Categories View
            let pillsHtml = '';
            categories.forEach((cat, index) => {
                pillsHtml += `
                    <button class="nav-link text-start fw-bold mb-1 ${index === 0 ? 'active' : ''}" 
                            data-bs-toggle="pill" 
                            type="button" 
                            role="tab"
                            onclick="loadCategoryExpenses(${cat.id}, '${cat.name}')">
                        <i class="fa-solid fa-tag me-2"></i>${cat.name}
                    </button>
                `;
            });
            categoryPills.innerHTML = pillsHtml;

            // Load expenses for the first category by default
            if (categories.length > 0) {
                loadCategoryExpenses(categories[0].id, categories[0].name);
            }
            
        } catch (err) {
            console.error('Error loading categories:', err);
        }
    }

    // Handle Category Dropdown Change
    categorySelect.addEventListener('change', function() {
        if (this.value === 'add_new') {
            newCategoryDiv.classList.remove('d-none');
            newCategoryName.focus();
        } else {
            newCategoryDiv.classList.add('d-none');
            newCategoryName.value = '';
            newCategoryError.classList.add('d-none');
        }
    });

    // Save New Category
    btnSaveCategory.addEventListener('click', async () => {
        const name = newCategoryName.value.trim();
        if (!name) return;

        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            const data = await res.json();

            if (!res.ok) {
                newCategoryError.textContent = data.error;
                newCategoryError.classList.remove('d-none');
            } else {
                newCategoryError.classList.add('d-none');
                newCategoryName.value = '';
                newCategoryDiv.classList.add('d-none');
                
                // Reload categories and select the new one
                await loadCategories();
                categorySelect.value = data.id;
            }
        } catch (err) {
            console.error('Error adding category:', err);
        }
    });

    // Submit New Expense
    addExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const catValue = categorySelect.value;
        if (catValue === 'add_new' || !catValue) {
            alert('Please select a valid category.');
            return;
        }

        const expenseData = {
            amount: document.getElementById('amount').value,
            description: document.getElementById('description').value,
            category_id: catValue,
            added_by: document.getElementById('addedBy').value
        };

        const btnSubmit = document.getElementById('btnSubmitExpense');
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';

        try {
            const res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expenseData)
            });

            if (res.ok) {
                addExpenseForm.reset();
                categorySelect.value = '';
                newCategoryDiv.classList.add('d-none');
                addExpenseModal.hide();
                
                // Immediately reload data
                loadExpenses(true);
                loadSummary();
            } else {
                const data = await res.json();
                alert('Error: ' + data.error);
            }
        } catch (err) {
            console.error('Error adding expense:', err);
            alert('An error occurred while adding the expense.');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Save Expense';
        }
    });

    // Format currency
    const formatMoney = (amount) => {
        return parseFloat(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Global function for onclick in category pills
    window.loadCategoryExpenses = async function(catId, catName, showLoading = true) {
        selectedCategoryId = catId;
        categoryViewTitle.textContent = catName;
        
        if (showLoading) {
            categoryExpenseTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Loading...</td></tr>';
        }
        
        try {
            const res = await fetch(`/api/expenses?category_id=${catId}`);
            if (res.ok) {
                const expenses = await res.json();
                
                // Calculate total
                const total = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
                categoryViewTotal.textContent = `₹${formatMoney(total)}`;

                if (expenses.length === 0) {
                    categoryExpenseTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No expenses found for this category.</td></tr>';
                    return;
                }

                let html = '';
                expenses.forEach(exp => {
                    let userBadgeClass = `badge badge-category badge-${exp.added_by}`;
                    const dateObj = new Date(exp.expense_date + 'T00:00:00');
                    const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

                    html += `
                        <tr>
                            <td class="text-nowrap">${dateStr}</td>
                            <td class="fw-bold">₹${formatMoney(exp.amount)}</td>
                            <td><span class="${userBadgeClass} px-2 py-1 rounded">${exp.added_by}</span></td>
                            <td class="text-muted">${exp.description || '-'}</td>
                            <td>
                                <div class="btn-group">
                                    <button class="btn btn-sm btn-outline-warning" onclick="openEditModal(${exp.id})"><i class="fa-solid fa-pen"></i></button>
                                    <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(${exp.id})"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </td>
                        </tr>
                    `;
                });
                categoryExpenseTableBody.innerHTML = html;
            }
        } catch (err) {
            console.error('Error loading category expenses:', err);
            if (showLoading) {
                categoryExpenseTableBody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Failed to load expenses.</td></tr>';
            }
        }
    };

    // Load Summary Cards
    async function loadSummary() {
        try {
            const res = await fetch('/api/summary');
            if (res.ok) {
                const data = await res.json();
                summaryMonth.textContent = formatMoney(data.this_month);
                summaryYear.textContent = formatMoney(data.this_year);
                summaryOverall.textContent = formatMoney(data.overall);
            }
        } catch (err) {
            console.error('Error loading summary:', err);
        }
    }

    // Load Expenses
    async function loadExpenses(showLoading = true) {
        if (showLoading && expenseTableBody.innerHTML.trim() === '') {
            expenseTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>Loading...</td></tr>';
        }

        // Build query string from filters
        const params = new URLSearchParams();
        const fromDate = document.getElementById('filterFromDate').value;
        const toDate = document.getElementById('filterToDate').value;
        const catId = document.getElementById('filterCategory').value;
        const addedBy = document.getElementById('filterAddedBy').value;
        const search = document.getElementById('filterSearch').value;

        if (fromDate) params.append('from_date', fromDate);
        if (toDate) params.append('to_date', toDate);
        if (catId) params.append('category_id', catId);
        if (addedBy && addedBy !== 'All') params.append('added_by', addedBy);
        if (search) params.append('search', search);

        try {
            const res = await fetch(`/api/expenses?${params.toString()}`);
            if (res.ok) {
                const expenses = await res.json();
                allExpenses = expenses; // Store in cache for easy editing
                renderExpenses(expenses);
            }
        } catch (err) {
            console.error('Error loading expenses:', err);
            if (showLoading) {
                expenseTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load expenses.</td></tr>';
            }
        }
    }

    // Render Expense Table
    function renderExpenses(expenses) {
        if (expenses.length === 0) {
            expenseTableBody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No expenses found.</td></tr>';
            if (expenseCount) expenseCount.textContent = '';
            return;
        }

        if (expenseCount) expenseCount.textContent = `${expenses.length} record(s)`;

        let html = '';
        expenses.forEach(exp => {
            // Badge color for user
            let userBadgeClass = `badge badge-category badge-${exp.added_by}`;
            
            // Format date nicely
            const dateObj = new Date(exp.expense_date + 'T00:00:00');
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

            html += `
                <tr>
                    <td class="text-nowrap">${dateStr}</td>
                    <td class="fw-bold">₹${formatMoney(exp.amount)}</td>
                    <td><span class="badge-category">${exp.category_name}</span></td>
                    <td><span class="${userBadgeClass} px-2 py-1 rounded">${exp.added_by}</span></td>
                    <td class="text-muted">${exp.description || '-'}</td>
                    <td>
                        <div class="btn-group">
                            <button class="btn btn-sm btn-outline-warning" onclick="openEditModal(${exp.id})"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteExpense(${exp.id})"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        expenseTableBody.innerHTML = html;
    }

    // Global Edit/Delete handlers
    window.openEditModal = function(id) {
        const exp = allExpenses.find(e => e.id === id);
        if (!exp) return;

        document.getElementById('editExpenseId').value = exp.id;
        document.getElementById('editAmount').value = exp.amount;
        document.getElementById('editDescription').value = exp.description || '';
        document.getElementById('editCategory').value = exp.category_id;
        document.getElementById('editAddedBy').value = exp.added_by;

        editExpenseModal.show();
    };

    window.deleteExpense = async function(id) {
        if (!confirm('Are you sure you want to delete this expense?')) return;

        try {
            const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadExpenses(true);
                loadSummary();
                if (selectedCategoryId) {
                    loadCategoryExpenses(selectedCategoryId, categoryViewTitle.textContent, false);
                }
            } else {
                alert('Failed to delete expense.');
            }
        } catch (err) {
            console.error('Error deleting expense:', err);
        }
    };

    // Update Expense
    editExpenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('editExpenseId').value;
        const expenseData = {
            amount: document.getElementById('editAmount').value,
            description: document.getElementById('editDescription').value,
            category_id: document.getElementById('editCategory').value,
            added_by: document.getElementById('editAddedBy').value
        };

        try {
            const res = await fetch(`/api/expenses/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expenseData)
            });

            if (res.ok) {
                editExpenseModal.hide();
                loadExpenses(true);
                loadSummary();
                if (selectedCategoryId) {
                    loadCategoryExpenses(selectedCategoryId, categoryViewTitle.textContent, false);
                }
            } else {
                const data = await res.json();
                alert('Error: ' + data.error);
            }
        } catch (err) {
            console.error('Error updating expense:', err);
        }
    });

    // Handle Filters
    filterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        loadExpenses(true);
        updateExportLink();
    });

    // Reset Filters
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        filterForm.reset();
        loadExpenses(true);
        updateExportLink();
    });

    // Update export CSV link with current filters
    function updateExportLink() {
        const params = new URLSearchParams();
        const fromDate = document.getElementById('filterFromDate').value;
        const toDate = document.getElementById('filterToDate').value;
        const catId = document.getElementById('filterCategory').value;
        const addedBy = document.getElementById('filterAddedBy').value;
        const search = document.getElementById('filterSearch').value;

        if (fromDate) params.append('from_date', fromDate);
        if (toDate) params.append('to_date', toDate);
        if (catId) params.append('category_id', catId);
        if (addedBy && addedBy !== 'All') params.append('added_by', addedBy);
        if (search) params.append('search', search);

        const btn = document.getElementById('btnExportCSV');
        if (btn) btn.href = `/api/export?${params.toString()}`;
    }

    // Initialize export link on load
    updateExportLink();
});
