'use client';

import React from 'react';
import { X, Home, FileText, User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
    onClose();
  };

  const handleLogout = () => {
    logout();
    onClose();
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-bold text-blue-600">Saarathi Finance</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-green-50">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold text-lg">
                {user?.name.charAt(0) || 'A'}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{user?.name}</h3>
                <p className="text-sm text-gray-600">{user?.rmId}</p>
              </div>
            </div>
            <div className="space-y-1 text-sm text-gray-700">
              <p className="flex items-center">
                <span className="font-medium w-16">Email:</span>
                <span>{user?.email}</span>
              </p>
              <p className="flex items-center">
                <span className="font-medium w-16">Phone:</span>
                <span>{user?.phone}</span>
              </p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            <button
              onClick={() => handleNavigation('/dashboard')}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors text-left"
            >
              <Home className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Home</span>
            </button>

            <button
              onClick={() => handleNavigation('/leads')}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors text-left"
            >
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Leads</span>
            </button>

            <button
              onClick={() => handleNavigation('/dashboard')}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-blue-50 transition-colors text-left"
            >
              <User className="w-5 h-5 text-blue-600" />
              <span className="font-medium">Profile</span>
            </button>
          </nav>

          <div className="p-4 border-t">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
