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
  LinearProgress,
  Grid,
  Card,
  CardContent,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';

// Mock data for demonstration
const mockBudgets = [
  {
    id: 1,
    category: 'Food',
    limit: 500,
    spent: 350,
    period: 'monthly',
  },
  {
    id: 2,
    category: 'Transportation',
    limit: 200,
    spent: 120,
    period: 'monthly',
  },
  {
    id: 3,
    category: 'Entertainment',
    limit: 300,
    spent: 250,
    period: 'monthly',
  },
];

const periods = ['daily', 'weekly', 'monthly', 'yearly'];

const BudgetDialog = ({ open, handleClose, budget, handleSave }) => {
  const [formData, setFormData] = useState(budget || {
    category: '',
    limit: '',
    spent: 0,
    period: 'monthly',
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {budget ? 'Edit Budget' : 'Add New Budget'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
          <TextField
            label="Category"
            value={formData.category}
            onChange={handleChange('category')}
            fullWidth
          />
          
          <TextField
            label="Budget Limit"
            type="number"
            value={formData.limit}
            onChange={handleChange('limit')}
            fullWidth
          />
          
          <TextField
            select
            label="Period"
            value={formData.period}
            onChange={handleChange('period')}
            fullWidth
          >
            {periods.map((period) => (
              <option key={period} value={period}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </option>
            ))}
          </TextField>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const BudgetCard = ({ budget, onEdit, onDelete }) => {
  const progress = (budget.spent / budget.limit) * 100;
  const isOverBudget = progress > 100;

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" gutterBottom>
              {budget.category}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {budget.period.charAt(0).toUpperCase() + budget.period.slice(1)} Budget
            </Typography>
          </Box>
          <Box>
            <IconButton size="small" onClick={() => onEdit(budget)}>
              <EditIcon />
            </IconButton>
            <IconButton size="small" onClick={() => onDelete(budget.id)}>
              <DeleteIcon />
            </IconButton>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Box display="flex" justifyContent="space-between" mb={1}>
            <Typography variant="body2">
              ${budget.spent.toLocaleString()} / ${budget.limit.toLocaleString()}
            </Typography>
            <Typography
              variant="body2"
              color={isOverBudget ? 'error.main' : 'text.secondary'}
            >
              {progress.toFixed(1)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={Math.min(progress, 100)}
            color={isOverBudget ? 'error' : 'primary'}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

const Budget = () => {
  const [budgets, setBudgets] = useState(mockBudgets);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState(null);

  const handleAdd = () => {
    setSelectedBudget(null);
    setOpenDialog(true);
  };

  const handleEdit = (budget) => {
    setSelectedBudget(budget);
    setOpenDialog(true);
  };

  const handleDelete = (id) => {
    setBudgets(budgets.filter((b) => b.id !== id));
  };

  const handleSave = (budget) => {
    if (selectedBudget) {
      setBudgets(
        budgets.map((b) =>
          b.id === selectedBudget.id ? { ...budget, id: b.id } : b
        )
      );
    } else {
      setBudgets([
        ...budgets,
        { ...budget, id: budgets.length + 1 },
      ]);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Budget Tracking</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAdd}
        >
          Add Budget
        </Button>
      </Box>

      <Grid container spacing={3}>
        {budgets.map((budget) => (
          <Grid item xs={12} sm={6} md={4} key={budget.id}>
            <BudgetCard
              budget={budget}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </Grid>
        ))}
      </Grid>

      <BudgetDialog
        open={openDialog}
        handleClose={() => setOpenDialog(false)}
        budget={selectedBudget}
        handleSave={handleSave}
      />
    </Box>
  );
};

export default Budget; 