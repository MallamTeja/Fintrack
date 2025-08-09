/**
 * Transaction Model Tests
 * Tests for the Transaction model functionality
 */

const Transaction = require('../../models/Transaction');
const User = require('../../models/User');
const { createTestUser } = require('../testUtils');

describe('Transaction Model', () => {
    let testUser;

    beforeEach(async () => {
        testUser = await createTestUser();
    });

    describe('Transaction Creation', () => {
        test('should create a valid transaction', async () => {
            const transactionData = {
                user: testUser._id,
                type: 'income',
                category: 'Salary',
                amount: 1000,
                description: 'Monthly salary',
                date: new Date()
            };
            
            const transaction = new Transaction(transactionData);
            const savedTransaction = await transaction.save();
            
            expect(savedTransaction._id).toBeDefined();
            expect(savedTransaction.user.toString()).toBe(testUser._id.toString());
            expect(savedTransaction.type).toBe('income');
            expect(savedTransaction.category).toBe('Salary');
            expect(savedTransaction.amount).toBe(1000);
            expect(savedTransaction.description).toBe('Monthly salary');
            expect(savedTransaction.date).toBeDefined();
            expect(savedTransaction.createdAt).toBeDefined();
            expect(savedTransaction.updatedAt).toBeDefined();
        });

        test('should fail to create transaction without required fields', async () => {
            const transaction = new Transaction({});
            await expect(transaction.save()).rejects.toThrow();
        });

        test('should fail to create transaction without user', async () => {
            const transactionData = {
                type: 'income',
                category: 'Salary',
                amount: 1000
            };
            
            const transaction = new Transaction(transactionData);
            await expect(transaction.save()).rejects.toThrow();
        });

        test('should fail to create transaction with invalid type', async () => {
            const transactionData = {
                user: testUser._id,
                type: 'invalid-type',
                category: 'Salary',
                amount: 1000
            };
            
            const transaction = new Transaction(transactionData);
            await expect(transaction.save()).rejects.toThrow();
        });

        test('should allow empty description', async () => {
            const transactionData = {
                user: testUser._id,
                type: 'expense',
                category: 'Food',
                amount: 50
            };
            
            const transaction = new Transaction(transactionData);
            const savedTransaction = await transaction.save();
            
            expect(savedTransaction.description).toBe('');
        });
    });

    describe('Transaction Types', () => {
        test('should accept income type', async () => {
            const transaction = new Transaction({
                user: testUser._id,
                type: 'income',
                category: 'Salary',
                amount: 1000
            });
            
            const savedTransaction = await transaction.save();
            expect(savedTransaction.type).toBe('income');
        });

        test('should accept expense type', async () => {
            const transaction = new Transaction({
                user: testUser._id,
                type: 'expense',
                category: 'Food',
                amount: 50
            });
            
            const savedTransaction = await transaction.save();
            expect(savedTransaction.type).toBe('expense');
        });
    });

    describe('Transaction Queries', () => {
        beforeEach(async () => {
            // Create test transactions
            await Transaction.create([
                {
                    user: testUser._id,
                    type: 'income',
                    category: 'Salary',
                    amount: 1000,
                    date: new Date('2023-01-01')
                },
                {
                    user: testUser._id,
                    type: 'expense',
                    category: 'Food',
                    amount: 50,
                    date: new Date('2023-01-02')
                },
                {
                    user: testUser._id,
                    type: 'expense',
                    category: 'Transport',
                    amount: 30,
                    date: new Date('2023-01-03')
                }
            ]);
        });

        test('should find transactions by user', async () => {
            const transactions = await Transaction.find({ user: testUser._id });
            expect(transactions).toHaveLength(3);
        });

        test('should find transactions by type', async () => {
            const incomeTransactions = await Transaction.find({ 
                user: testUser._id, 
                type: 'income' 
            });
            expect(incomeTransactions).toHaveLength(1);
            
            const expenseTransactions = await Transaction.find({ 
                user: testUser._id, 
                type: 'expense' 
            });
            expect(expenseTransactions).toHaveLength(2);
        });

        test('should find transactions by category', async () => {
            const foodTransactions = await Transaction.find({ 
                user: testUser._id, 
                category: 'Food' 
            });
            expect(foodTransactions).toHaveLength(1);
        });

        test('should sort transactions by date', async () => {
            const transactions = await Transaction.find({ user: testUser._id })
                .sort({ date: -1 });
            
            expect(transactions[0].category).toBe('Transport');
            expect(transactions[1].category).toBe('Food');
            expect(transactions[2].category).toBe('Salary');
        });
    });
});