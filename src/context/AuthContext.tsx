import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { StorageDB } from '../services/db';

interface AuthContextType {
  currentUser: User;
  users: User[];
  setCurrentUser: (user: User) => void;
  switchRole: (role: UserRole) => void;
  hasPermission: (requiredRoles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User>({
    id: 'usr-1',
    name: 'Tariq Al-Mansoor',
    login: 'tariq.admin',
    role: 'admin',
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  });

  useEffect(() => {
    StorageDB.init();
    const loadedUsers = StorageDB.getUsers();
    setUsers(loadedUsers);
    if (loadedUsers.length > 0) {
      setCurrentUser(loadedUsers[0]);
    }
  }, []);

  const switchRole = (role: UserRole) => {
    const match = users.find((u) => u.role === role) || {
      id: `usr-temp-${role}`,
      name: `${role.toUpperCase()} User`,
      login: `user.${role}`,
      role: role,
      status: 'active',
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
    setCurrentUser(match);
  };

  const hasPermission = (requiredRoles: UserRole[]): boolean => {
    if (currentUser.role === 'admin') return true;
    return requiredRoles.includes(currentUser.role);
  };

  return (
    <AuthContext.Provider value={{ currentUser, users, setCurrentUser, switchRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
