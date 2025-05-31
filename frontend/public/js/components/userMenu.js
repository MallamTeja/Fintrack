// User Menu Component
class UserMenu {
    constructor() {
        this.init();
    }

    init() {
        // Create and append the user menu HTML
        const menuHTML = `
            <div class="user-menu">
                <div class="user-dropdown">
                    <button class="user-button" id="userMenuButton">
                        <i class="fas fa-user-circle"></i>
                        <span id="username">Loading...</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div class="dropdown-content" id="userDropdown">
                        <a href="profile.html"><i class="fas fa-user"></i> Profile</a>
                        <a href="settings.html"><i class="fas fa-cog"></i> Settings</a>
                        <a href="#" id="logoutButton"><i class="fas fa-sign-out-alt"></i> Logout</a>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const styles = `
            .user-menu {
                position: fixed;
                top: 1rem;
                right: 2rem;
                z-index: 1000;
            }

            .user-dropdown {
                position: relative;
                display: inline-block;
            }

            .user-button {
                background: var(--card-bg);
                border: 1px solid var(--border);
                padding: 0.75rem 1rem;
                border-radius: 0.5rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: var(--text);
                font-size: 1rem;
                transition: var(--transition);
            }

            .user-button:hover {
                background: var(--bg);
            }

            .dropdown-content {
                display: none;
                position: absolute;
                right: 0;
                top: 120%;
                background: var(--card-bg);
                border: 1px solid var(--border);
                border-radius: 0.5rem;
                min-width: 200px;
                box-shadow: var(--shadow);
            }

            .dropdown-content.show {
                display: block;
            }

            .dropdown-content a {
                color: var(--text);
                padding: 0.75rem 1rem;
                text-decoration: none;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                transition: var(--transition);
            }

            .dropdown-content a:hover {
                background: var(--bg);
            }

            .dropdown-content a i {
                width: 20px;
            }
        `;

        // Add styles to document
        const styleSheet = document.createElement("style");
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // Add menu to document
        document.body.insertAdjacentHTML('afterbegin', menuHTML);

        // Add event listeners
        this.addEventListeners();
        this.loadUserData();
    }

    async loadUserData() {
        try {
            const token = localStorage.getItem('token');
            if (!token) {
                window.location.href = '/login.html';
                return;
            }

            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const user = await response.json();
            document.getElementById('username').textContent = user.name;
        } catch (error) {
            console.error('Error loading user data:', error);
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    }

    addEventListeners() {
        // Toggle dropdown
        document.getElementById('userMenuButton').addEventListener('click', () => {
            document.getElementById('userDropdown').classList.toggle('show');
        });

        // Close dropdown when clicking outside
        window.addEventListener('click', (event) => {
            if (!event.target.matches('.user-button') && !event.target.matches('.user-button *')) {
                const dropdown = document.getElementById('userDropdown');
                if (dropdown.classList.contains('show')) {
                    dropdown.classList.remove('show');
                }
            }
        });

        // Handle logout
        document.getElementById('logoutButton').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        });
    }
}

// Initialize the user menu when the script loads
window.addEventListener('DOMContentLoaded', () => {
    new UserMenu();
}); 