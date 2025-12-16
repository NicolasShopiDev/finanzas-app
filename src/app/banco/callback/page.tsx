"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// API response interface
interface CallbackResponse {
  ok: boolean;
  data?: {
    connection_id: string;
    account_id: string;
    iban: string;
    account_name: string;
    status: string;
  };
  error?: string;
  status?: string;
}

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Procesando autorización bancaria...");
  const [accountInfo, setAccountInfo] = useState<{
    iban?: string;
    account_name?: string;
  } | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      // Get the ref (requisition_id) from URL params
      const ref = searchParams.get("ref");

      if (!ref) {
        setStatus("error");
        setMessage("No se encontró la referencia de autorización. Por favor, intenta conectar tu banco nuevamente.");
        return;
      }

      console.log("[Bank Callback] Processing requisition:", ref);

      try {
        const res = await fetch("/api/nordigen/callback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requisition_id: ref })
        });

        const data: CallbackResponse = await res.json();

        if (data.ok) {
          setStatus("success");
          setMessage("¡Tu banco se ha conectado correctamente!");
          setAccountInfo({
            iban: data.data?.iban,
            account_name: data.data?.account_name
          });

          // Auto-redirect after 3 seconds
          setTimeout(() => {
            router.push("/conectar-banco");
          }, 3000);
        } else {
          setStatus("error");

          // Handle different error statuses
          if (data.status === "EX") {
            setMessage("La autorización ha expirado. Por favor, intenta conectar tu banco nuevamente.");
          } else if (data.status === "RJ" || data.status === "UA") {
            setMessage("La autorización fue rechazada o cancelada. Por favor, intenta nuevamente.");
          } else {
            setMessage(data.error || "Error al procesar la autorización bancaria.");
          }
        }
      } catch (error) {
        console.error("[Bank Callback] Error:", error);
        setStatus("error");
        setMessage("Error de conexión. Por favor, intenta nuevamente.");
      }
    };

    processCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center">
            {status === "processing" && (
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            )}
            {status === "success" && (
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in-50 duration-300">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {status === "error" && (
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center animate-in zoom-in-50 duration-300">
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === "processing" && "Conectando tu banco..."}
            {status === "success" && "¡Conexión exitosa!"}
            {status === "error" && "Error de conexión"}
          </CardTitle>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "success" && accountInfo && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              {accountInfo.account_name && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Titular:</span>
                  <span className="text-sm font-medium">{accountInfo.account_name}</span>
                </div>
              )}
              {accountInfo.iban && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">IBAN:</span>
                  <span className="text-sm font-medium font-mono">{accountInfo.iban}</span>
                </div>
              )}
            </div>
          )}

          {status === "success" && (
            <div className="text-center text-sm text-muted-foreground">
              <p>Redirigiendo automáticamente en 3 segundos...</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            {status === "success" && (
              <Button asChild className="w-full">
                <Link href="/conectar-banco">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizar Movimientos
                </Link>
              </Button>
            )}

            {status === "error" && (
              <Button asChild className="w-full">
                <Link href="/conectar-banco">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Intentar de nuevo
                </Link>
              </Button>
            )}

            <Button variant="outline" asChild className="w-full">
              <Link href="/">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Volver al Dashboard
              </Link>
            </Button>
          </div>

          {/* Security note */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <svg className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-xs text-muted-foreground">
              Tu conexión está protegida con los más altos estándares de seguridad bancaria (PSD2).
              Nunca tenemos acceso a tus credenciales bancarias.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BancoCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-20 h-20 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
              <svg className="animate-spin h-10 w-10 text-primary" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <CardTitle className="text-2xl">Cargando...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
