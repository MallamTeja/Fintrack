import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// Mock data for demonstration
const mockTransactions = [
  {
    id: 1,
    date: '2024-03-15',
    description: 'Grocery Shopping',
    amount: -150.00,
    category: 'Food',
    type: 'expense',
  },
  {
    id: 2,
    date: '2024-03-14',
    description: 'Salary',
    amount: 4500.00,
    category: 'Income',
    type: 'income',
  },
  // Add more mock transactions as needed
];

const categories = [
  'Food',
  'Transportation',
  'Housing',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Income',
  'Other',
];

const TransactionDialog = ({ open, handleClose, transaction, handleSave }) => {
  const [formData, setFormData] = useState(transaction || {
    date: new Date(),
    description: '',
    amount: '',
    category: '',
    type: 'expense',
  });

  const handleChange = (field) => (event) => {
    setFormData({
      ...formData,
      [field]: event.target.value,
    });
  };

  const handleSubmit = () => {
    handleSave(formData);
    handleClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="xs" 
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
          maxWidth: '400px',
          margin: '16px'
        }
      }}
    >
      <DialogTitle sx={{ pb: 1, fontSize: '1.1rem' }}>
        {transaction ? 'Edit Transaction' : 'Add New Transaction'}
      </DialogTitle>
      <DialogContent sx={{ pb: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Date"
              value={formData.date}
              onChange={(newValue) => {
                setFormData({ ...formData, date: newValue });
              }}
              renderInput={(params) => (
                <TextField 
                  {...params} 
                  fullWidth 
                  size="small"
                  sx={{ '& .MuiInputBase-root': { height: '36px' } }}
                />
              )}
            />
          </LocalizationProvider>
          
          <TextField
            label="Description"
            value={formData.description}
            onChange={handleChange('description')}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { height: '36px' } }}
          />
          
          <TextField
            label="Amount"
            type="number"
            value={formData.amount}
            onChange={handleChange('amount')}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { height: '36px' } }}
          />
          
          <TextField
            select
            label="Category"
            value={formData.category}
            onChange={handleChange('category')}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { height: '36px' } }}
          >
            {categories.map((category) => (
              <MenuItem key={category} value={category}>
                {category}
              </MenuItem>
            ))}
          </TextField>
          
          <TextField
            select
            label="Type"
            value={formData.type}
            onChange={handleChange('type')}
            fullWidth
            size="small"
            sx={{ '& .MuiInputBase-root': { height: '36px' } }}
          >
            <MenuItem value="income">Income</MenuItem>
            <MenuItem value="expense">Expense</MenuItem>
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button 
          onClick={handleClose}
          variant="outlined"
          size="small"
          sx={{ minWidth: '80px' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          size="small"
          sx={{ minWidth: '80px' }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const Transactions = () => {
  const [transactions, setTransactions] = useState(mockTransactions);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);

  const columns = [
    { field: 'date', headerName: 'Date', width: 130 },
    { field: 'description', headerName: 'Description', width: 200 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 130,
      renderCell: (params) => (
        <Typography
          color={params.row.type === 'income' ? 'success.main' : 'error.main'}
        >
          ${params.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Typography>
      ),
    },
    { field: 'category', headerName: 'Category', width: 130 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
      renderCell: (params) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => handleEdit(params.row)}
            color="primary"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  const handleAdd = () => {
    setSelectedTransaction(null);
    setOpenDialog(true);
  };

  const handleEdit = (transaction) => {
    setSelectedTransaction(transaction);
    setOpenDialog(true);
  };

  const handleDelete = (id) => {
    setTransactions(transactions.filter((t) => t.id !== id));
  };

  const handleSave = (transaction) => {
    if (selectedTransaction) {
      setTransactions(
        transactions.map((t) =>
          t.id === selectedTransaction.id ? { ...transaction, id: t.id } : t
        )
      );
    } else {
      setTransactions([
        ...transactions,
        { ...transaction, id: transactions.length + 1 },
      ]);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Transactions</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          Add Transaction
        </Button>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={transactions}
          columns={columns}
          pageSize={10}
          rowsPerPageOptions={[10]}
          checkboxSelection
          disableSelectionOnClick
        />
      </Paper>

      <TransactionDialog
        open={openDialog}
        handleClose={() => setOpenDialog(false)}
        transaction={selectedTransaction}
        handleSave={handleSave}
      />
    </Box>
  );
};

export default Transactions; 