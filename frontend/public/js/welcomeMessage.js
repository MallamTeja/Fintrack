// Array of inspirational quotes
const quotes = [
    { text: "The best way to predict the future is to create it. 🚀", author: "Peter Drucker" },
    { text: "Success is not final, failure is not fatal: it is the courage to continue that counts. ✨", author: "Winston Churchill" },
    { text: "Every penny saved is a penny earned. 💰", author: "Benjamin Franklin" },
    { text: "Investment in knowledge pays the best interest. 📚", author: "Benjamin Franklin" },
    { text: "The journey of a thousand miles begins with one step. 👣", author: "Lao Tzu" },
    { text: "Your future is created by what you do today, not tomorrow. 🎯", author: "Robert Kiyosaki" },
    { text: "Financial freedom is freedom from fear. 🦋", author: "Robert Kiyosaki" },
    { text: "Don't watch the clock; do what it does. Keep going. ⏰", author: "Sam Levenson" }
];

// Function to get time-based greeting
function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Good morning";
    if (hour >= 12 && hour < 17) return "Good afternoon";
    if (hour >= 17 && hour < 22) return "Good evening";
    return "Good night";
}

// Function to get random quote
function getRandomQuote() {
    return quotes[Math.floor(Math.random() * quotes.length)];
}

// Function to update welcome message
function updateWelcomeMessage() {
    const welcomeMessageEl = document.getElementById('welcomeMessage');
    const quoteEl = document.getElementById('inspirationalQuote');
    
    // Get user data from localStorage
    let userName = 'User';
    try {
        const userData = JSON.parse(localStorage.getItem('user'));
        if (userData && userData.name) {
            userName = userData.name;
        }
    } catch (error) {
        console.error('Error parsing user data:', error);
    }

    // Set welcome message
    const greeting = getGreeting();
    welcomeMessageEl.textContent = `${greeting}, ${userName}! 👋`;

    // Set random quote
    const quote = getRandomQuote();
    quoteEl.textContent = `"${quote.text}" - ${quote.author}`;
}

// Update message when page loads
document.addEventListener('DOMContentLoaded', () => {
    updateWelcomeMessage();
    // Update greeting every minute to handle time changes
    setInterval(updateWelcomeMessage, 60000);
}); 