// src/components/common/Footer.tsx
"use client";

import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <span className="text-2xl">💰</span>
              <span className="font-bold text-lg">FinanzasApp</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Gestiona tus finanzas personales de forma sencilla y eficiente.
              Controla tus gastos y alcanza tus metas financieras.
            </p>
          </div>

          {/* Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide">Enlaces</h3>
            <nav className="flex flex-col space-y-2">
              <Link href="/" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Dashboard
              </Link>
              <Link href="/estadisticas" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Estadísticas
              </Link>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="font-semibold text-sm uppercase tracking-wide">Legal</h3>
            <nav className="flex flex-col space-y-2">
              <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Política de Privacidad
              </Link>
              <Link href="/terms-of-service" className="text-sm text-muted-foreground hover:text-primary transition-colors">
                Términos de Servicio
              </Link>
            </nav>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t">
          <p className="text-sm text-muted-foreground text-center">
            © {currentYear} FinanzasApp. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}
