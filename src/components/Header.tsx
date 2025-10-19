"use client";

import React from "react";
import Link from "next/link";
import { Bot, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const menuItems = [
  { name: "Возможности", href: "#features" },
  { name: "Тарифы", href: "#pricing" },
  { name: "Контакты", href: "#contacts" },
];

export default function Header() {
  const [menuState, setMenuState] = React.useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200/50 shadow-sm">
      <nav className="container max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between py-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 group transition-all duration-300"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl opacity-0 group-hover:opacity-100 blur transition-opacity duration-300" />
              <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-xl shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                <Bot className="w-6 h-6 text-white" />
              </div>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ReplIQ
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-8">
            <ul className="flex items-center gap-8">
              {menuItems.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    className="text-gray-700 hover:text-blue-600 font-medium transition-colors duration-200 relative group"
                  >
                    {item.name}
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-600 to-purple-600 group-hover:w-full transition-all duration-300" />
                  </Link>
                </li>
              ))}
            </ul>
            <Button
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              Попробовать бесплатно
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMenuState(!menuState)}
            aria-label={menuState ? "Закрыть меню" : "Открыть меню"}
            className="lg:hidden relative z-50 p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <Menu
              className={`w-6 h-6 transition-all duration-300 ${
                menuState ? "rotate-180 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
              }`}
            />
            <X
              className={`absolute inset-0 m-auto w-6 h-6 transition-all duration-300 ${
                menuState ? "rotate-0 scale-100 opacity-100" : "-rotate-180 scale-0 opacity-0"
              }`}
            />
          </button>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden overflow-hidden transition-all duration-300 ${
            menuState ? "max-h-96 opacity-100 mb-6" : "max-h-0 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-4 pt-4 border-t border-gray-200">
            <ul className="space-y-4">
              {menuItems.map((item, index) => (
                <li key={index}>
                  <Link
                    href={item.href}
                    onClick={() => setMenuState(false)}
                    className="block text-gray-700 hover:text-blue-600 font-medium py-2 px-4 rounded-lg hover:bg-gray-50 transition-all duration-200"
                  >
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
            <Button
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg"
              onClick={() => setMenuState(false)}
            >
              Попробовать бесплатно
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
}