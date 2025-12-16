// src/components/common/Header.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full glass-nav overflow-x-hidden">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 max-w-6xl">
        <div className="flex h-14 sm:h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group flex-shrink-0">
            {/* Curva Logo Mark */}
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center">
              <div className="absolute inset-0 rounded-xl gradient-curva opacity-20 group-hover:opacity-30 transition-opacity" />
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 sm:w-6 sm:h-6 relative z-10"
                fill="none"
                stroke="url(#curvaGradient)"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <defs>
                  <linearGradient id="curvaGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#00C2FF" />
                    <stop offset="100%" stopColor="#00D68F" />
                  </linearGradient>
                </defs>
                <path d="M3 17C3 17 7 10 12 10C17 10 21 17 21 17" />
                <circle cx="12" cy="10" r="2" fill="url(#curvaGradient)" stroke="none" />
              </svg>
            </div>
            <span className="font-bold text-lg sm:text-xl tracking-tight text-white group-hover:text-primary transition-colors">
              Curva
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-0.5 xl:space-x-1">
            <NavLink href="/" label="Dashboard" />
            <NavLink href="/ingresos" label="Ingresos" icon={<IncomeIcon />} />
            <NavLink href="/ahorro" label="Ahorro" icon={<SavingsIcon />} />
            <NavLink href="/estadisticas" label="Estadísticas" />
            <NavLink href="/conectar-banco" label="Banco" icon={<BankIcon />} />
            <NavLink href="/movimientos-pendientes" label="Pendientes" icon={<PendingIcon />} />
            <NavLink href="/objetivos" label="Objetivos" icon={<GoalsIcon />} />
            <NavLink href="/alertas" label="Alertas" icon={<AlertIcon />} isAI />
            <NavLink href="/mi-cuenta" label="Mi cuenta" icon={<AccountIcon />} />
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileMenuOpen ? (
                <path d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 sm:py-4 space-y-1 border-t border-white/5">
            <MobileNavLink href="/" label="Dashboard" onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/ingresos" label="Ingresos" icon={<IncomeIcon />} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/ahorro" label="Ahorro" icon={<SavingsIcon />} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/estadisticas" label="Estadísticas" onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/conectar-banco" label="Conectar Banco" icon={<BankIcon />} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/movimientos-pendientes" label="Pendientes" icon={<PendingIcon />} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/objetivos" label="Objetivos" icon={<GoalsIcon />} onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/alertas" label="Alertas IA" icon={<AlertIcon />} isAI onClick={() => setMobileMenuOpen(false)} />
            <MobileNavLink href="/mi-cuenta" label="Mi cuenta" icon={<AccountIcon />} onClick={() => setMobileMenuOpen(false)} />
          </div>
        )}
      </div>
    </header>
  );
}

// Desktop Nav Link Component
function NavLink({ href, label, icon, isAI }: { href: string; label: string; icon?: React.ReactNode; isAI?: boolean }) {
  return (
    <Link
      href={href}
      className={`
        px-2.5 xl:px-4 py-2 rounded-full text-xs xl:text-sm font-medium transition-all duration-200
        flex items-center gap-1.5 xl:gap-2 whitespace-nowrap
        ${isAI
          ? 'text-[#00C2FF] hover:bg-[#00C2FF]/10'
          : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
        }
      `}
    >
      {icon && <span className="w-3.5 h-3.5 xl:w-4 xl:h-4">{icon}</span>}
      {label}
      {isAI && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#00C2FF] ai-pulse" />
      )}
    </Link>
  );
}

// Mobile Nav Link Component
function MobileNavLink({
  href,
  label,
  icon,
  isAI,
  onClick
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  isAI?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
        ${isAI
          ? 'text-[#00C2FF] bg-[#00C2FF]/5'
          : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
        }
      `}
      onClick={onClick}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      {label}
      {isAI && (
        <span className="ml-auto w-2 h-2 rounded-full bg-[#00C2FF] ai-pulse" />
      )}
    </Link>
  );
}

// Icons
function BankIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  );
}

function PendingIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function GoalsIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IncomeIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function SavingsIcon() {
  return (
    <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
