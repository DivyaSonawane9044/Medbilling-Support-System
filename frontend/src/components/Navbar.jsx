import React from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { Heart, Bell, Search } from "lucide-react";
import "./Navbar.css";

export default function Navbar() {
  const { user } = useUser();

  return (
    <header className="top-nav">
      <div className="top-nav-left">
        <div className="logo">
          <Heart className="logo-icon" />
          <h1 className="top-nav-title">MEDBILLING SUPPORT SYSTEM</h1>
        </div>
      </div>

      <div className="top-nav-center">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="search"
            className="top-nav-search"
            placeholder="Search medicines, customers, invoices..."
          />
        </div>
      </div>

      <div className="top-nav-right">
        <button className="top-nav-icon-btn" aria-label="Notifications">
          <Bell />
          <span className="notification-badge">3</span>
        </button>
        
        <div className="top-nav-user">
          <div className="user-info">
            <div className="user-avatar">
              {user?.firstName?.charAt(0) || user?.emailAddresses[0]?.emailAddress?.charAt(0) || 'U'}
            </div>
            <div className="user-details">
              <div className="user-name">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.emailAddresses[0]?.emailAddress || 'User'
                }
              </div>
              <div className="user-role">Pharmacy Administrator</div>
            </div>
          </div>
          
          {/* Clerk UserButton for profile management */}
          <div className="user-button-container">
            <UserButton 
              appearance={{
                elements: {
                  avatarBox: "clerk-avatar-box",
                  userButtonPopoverCard: "clerk-popover-card",
                  userButtonBox: "clerk-user-button-box",
                }
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
