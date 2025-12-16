"use client";

import { useState, useEffect, useCallback } from "react";
import { BankConnection, NordigenInstitution, BankTransaction } from "@/types/database";
import Link from "next/link";

// API response interfaces
interface ConfigResponse {
  ok: boolean;
  data?: {
    isConfigured: boolean;
    hasCredentials: boolean;
    configId: string | null;
  };
  error?: string;
}

interface InstitutionsResponse {
  ok: boolean;
  data?: NordigenInstitution[];
  error?: string;
}

interface ConnectionsResponse {
  ok: boolean;
  data?: BankConnection[];
  error?: string;
}

interface TransactionsResponse {
  ok: boolean;
  data?: BankTransaction[];
  error?: string;
  metadata?: { count: number };
}

interface ConnectResponse {
  ok: boolean;
  data?: {
    requisition_id: string;
    link: string;
    connection_id: string;
  };
  error?: string;
}

interface SyncResponse {
  ok: boolean;
  data?: {
    total_fetched: number;
    new_imported: number;
    skipped_duplicates: number;
  };
  error?: string;
}

interface DeleteResponse {
  ok: boolean;
  error?: string;
}

export default function ConectarBancoPage() {
  // State
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [secretId, setSecretId] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsError, setCredentialsError] = useState("");

  const [institutions, setInstitutions] = useState<NordigenInstitution[]>([]);
  const [loadingInstitutions, setLoadingInstitutions] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [connections, setConnections] = useState<BankConnection[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);

  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [syncingConnection, setSyncingConnection] = useState<string | null>(null);

  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  const [connectingBank, setConnectingBank] = useState<string | null>(null);

  // Check configuration status
  useEffect(() => {
    checkConfiguration();
  }, []);

  const checkConfiguration = async () => {
    try {
      const res = await fetch("/api/nordigen/config");
      const data: ConfigResponse = await res.json();
      setIsConfigured(data.data?.isConfigured || false);

      if (data.data?.isConfigured) {
        fetchConnections();
        fetchInstitutions();
      }
    } catch (error) {
      console.error("Error checking config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save credentials
  const handleSaveCredentials = async () => {
    if (!secretId.trim() || !secretKey.trim()) {
      setCredentialsError("Por favor, introduce ambas credenciales");
      return;
    }

    setSavingCredentials(true);
    setCredentialsError("");

    try {
      const res = await fetch("/api/nordigen/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret_id: secretId, secret_key: secretKey })
      });

      const data: ConfigResponse = await res.json();

      if (data.ok) {
        setIsConfigured(true);
        setShowCredentialsDialog(false);
        setSecretId("");
        setSecretKey("");
        fetchInstitutions();
        fetchConnections();
      } else {
        setCredentialsError(data.error || "Error al guardar las credenciales");
      }
    } catch (error) {
      console.error("Error saving credentials:", error);
      setCredentialsError("Error de conexión");
    } finally {
      setSavingCredentials(false);
    }
  };

  // Fetch institutions
  const fetchInstitutions = async () => {
    setLoadingInstitutions(true);
    try {
      const res = await fetch("/api/nordigen/institutions?country=ES");
      const data: InstitutionsResponse = await res.json();
      if (data.ok) {
        setInstitutions(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching institutions:", error);
    } finally {
      setLoadingInstitutions(false);
    }
  };

  // Fetch connections
  const fetchConnections = useCallback(async () => {
    setLoadingConnections(true);
    try {
      const res = await fetch("/api/nordigen/connections");
      const data: ConnectionsResponse = await res.json();
      if (data.ok) {
        setConnections(data.data || []);
        const connectedAccounts = (data.data || []).filter((c) => c.status === "conectado");
        if (connectedAccounts.length > 0) {
          fetchTransactions();
        }
      }
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setLoadingConnections(false);
    }
  }, []);

  // Fetch transactions
  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const res = await fetch("/api/nordigen/transactions?limit=20");
      const data: TransactionsResponse = await res.json();
      if (data.ok) {
        setTransactions(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoadingTransactions(false);
    }
  };

  // Connect to bank
  const handleConnectBank = async (institution: NordigenInstitution) => {
    setConnectingBank(institution.id);
    try {
      const redirectUrl = `${window.location.origin}/banco/callback`;

      const res = await fetch("/api/nordigen/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution_id: institution.id,
          institution_name: institution.name,
          redirect_url: redirectUrl
        })
      });

      const data: ConnectResponse = await res.json();

      if (data.ok && data.data?.link) {
        window.location.href = data.data.link;
      } else {
        alert(data.error || "Error al conectar con el banco");
      }
    } catch (error) {
      console.error("Error connecting bank:", error);
      alert("Error de conexión");
    } finally {
      setConnectingBank(null);
    }
  };

  // Sync transactions
  const handleSyncTransactions = async (connectionId: string) => {
    setSyncingConnection(connectionId);
    try {
      const res = await fetch("/api/nordigen/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connection_id: connectionId })
      });

      const data: SyncResponse = await res.json();

      if (data.ok) {
        alert(`Sincronizados ${data.data?.new_imported || 0} nuevos movimientos`);
        fetchTransactions();
        fetchConnections();
      } else {
        alert(data.error || "Error al sincronizar");
      }
    } catch (error) {
      console.error("Error syncing:", error);
      alert("Error de conexión");
    } finally {
      setSyncingConnection(null);
    }
  };

  // Delete connection
  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm("¿Estás seguro de eliminar esta conexión? Se eliminarán también todos los movimientos asociados.")) {
      return;
    }

    try {
      const res = await fetch(`/api/nordigen/connections?id=${connectionId}`, { method: "DELETE" });
      const data: DeleteResponse = await res.json();

      if (data.ok) {
        fetchConnections();
        fetchTransactions();
      } else {
        alert(data.error || "Error al eliminar");
      }
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Error de conexión");
    }
  };

  // Filter institutions
  const filteredInstitutions = institutions.filter(i =>
    i.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full gradient-curva flex items-center justify-center animate-pulse">
            <span className="text-3xl">🏦</span>
          </div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="glass-nav sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2 text-foreground">
                  <span className="text-3xl">🏦</span>
                  Conectar Banco
                </h1>
                <p className="text-sm text-muted-foreground">
                  Importa automáticamente tus movimientos bancarios
                </p>
              </div>
            </div>

            {isConfigured && (
              <button
                onClick={() => setShowCredentialsDialog(true)}
                className="btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Configuración
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {!isConfigured ? (
          // Configuration required view
          <div className="max-w-2xl mx-auto">
            <div className="card-surface p-8 rounded-2xl border-2 border-dashed border-border">
              <div className="text-center mb-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Configura tu Conexión Bancaria</h2>
                <p className="text-muted-foreground">
                  Para conectar tu banco necesitas credenciales de Nordigen/GoCardless
                </p>
              </div>

              {/* Security badges */}
              <div className="flex flex-wrap justify-center gap-2 mb-8">
                <span className="badge badge-primary">PSD2 Compliant</span>
                <span className="badge badge-primary">Encriptación SSL</span>
                <span className="badge badge-primary">Sin acceso a contraseñas</span>
              </div>

              {/* Steps */}
              <div className="space-y-4 mb-8">
                <div className="p-4 rounded-xl bg-card">
                  <h4 className="font-semibold flex items-center gap-2 text-foreground mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">1</span>
                    Crea una cuenta gratuita en Nordigen
                  </h4>
                  <p className="text-sm text-muted-foreground ml-8">
                    Ve a{" "}
                    <a
                      href="https://bankaccountdata.gocardless.com/signup"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                    >
                      bankaccountdata.gocardless.com
                    </a>
                    {" "}y regístrate (es gratis)
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-card">
                  <h4 className="font-semibold flex items-center gap-2 text-foreground mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">2</span>
                    Obtén tus credenciales API
                  </h4>
                  <p className="text-sm text-muted-foreground ml-8">
                    En el panel de Nordigen, ve a &quot;Secrets&quot; y copia tu Secret ID y Secret Key
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-card">
                  <h4 className="font-semibold flex items-center gap-2 text-foreground mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm flex items-center justify-center">3</span>
                    Introduce tus credenciales aquí
                  </h4>
                  <div className="ml-8 space-y-3 mt-3">
                    <div>
                      <label className="text-sm font-medium text-foreground">Secret ID</label>
                      <input
                        type="text"
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        value={secretId}
                        onChange={(e) => setSecretId(e.target.value)}
                        className="mt-1 w-full px-4 py-2 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Secret Key</label>
                      <input
                        type="password"
                        placeholder="••••••••••••••••"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        className="mt-1 w-full px-4 py-2 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                      />
                    </div>
                    {credentialsError && (
                      <p className="text-sm text-destructive">{credentialsError}</p>
                    )}
                  </div>
                </div>
              </div>

              <button
                className="btn-primary w-full flex items-center justify-center gap-2"
                onClick={handleSaveCredentials}
                disabled={savingCredentials}
              >
                {savingCredentials ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Verificando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Guardar y Verificar Credenciales
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          // Configured view
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Bank connections & selection */}
            <div className="lg:col-span-2 space-y-6">
              {/* Connected accounts */}
              {connections.length > 0 && (
                <div className="card-surface p-6 rounded-2xl">
                  <div className="mb-4">
                    <h2 className="text-h2 font-semibold flex items-center gap-2 text-foreground">
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Cuentas Conectadas
                    </h2>
                    <p className="text-sm text-muted-foreground">Gestiona tus conexiones bancarias</p>
                  </div>
                  {loadingConnections ? (
                    <div className="space-y-3">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-20 bg-card animate-pulse rounded-xl" />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {connections.map((conn) => (
                        <div
                          key={conn._id}
                          className="flex items-center justify-between p-4 rounded-xl bg-card border border-border hover:shadow-lg transition-shadow"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-xl">🏦</span>
                            </div>
                            <div>
                              <h4 className="font-semibold text-foreground">{conn.bank_name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {conn.iban || "IBAN no disponible"}
                              </p>
                              {conn.last_sync && (
                                <p className="text-xs text-muted-foreground">
                                  Última sync: {formatDate(conn.last_sync)}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`badge ${
                              conn.status === "conectado" ? "badge-primary" :
                              conn.status === "pendiente" ? "badge-warning" :
                              "badge-danger"
                            }`}>
                              {conn.status}
                            </span>
                            {conn.status === "conectado" && (
                              <button
                                onClick={() => handleSyncTransactions(conn._id)}
                                disabled={syncingConnection === conn._id}
                                className="p-2 rounded-lg bg-card hover:bg-card-elevated border border-border transition-colors"
                              >
                                {syncingConnection === conn._id ? (
                                  <svg className="animate-spin h-4 w-4 text-foreground" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteConnection(conn._id)}
                              className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Available banks */}
              <div className="card-surface p-6 rounded-2xl">
                <div className="mb-4">
                  <h2 className="text-h2 font-semibold flex items-center gap-2 text-foreground">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Conectar Nuevo Banco
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Selecciona tu banco para importar movimientos automáticamente
                  </p>
                </div>

                {/* Search */}
                <div className="relative mb-4">
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Buscar banco..."
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                {loadingInstitutions ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="animate-pulse h-24 bg-card rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                    {filteredInstitutions.slice(0, 30).map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => handleConnectBank(inst)}
                        disabled={connectingBank === inst.id}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary hover:shadow-lg transition-all text-center group disabled:opacity-50"
                      >
                        {inst.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={inst.logo}
                            alt={inst.name}
                            className="w-10 h-10 object-contain"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-card-elevated flex items-center justify-center">
                            <span className="text-lg">🏦</span>
                          </div>
                        )}
                        <span className="text-sm font-medium line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                          {inst.name}
                        </span>
                        {connectingBank === inst.id && (
                          <svg className="animate-spin h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {filteredInstitutions.length === 0 && !loadingInstitutions && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No se encontraron bancos con ese nombre</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right column - Recent transactions */}
            <div className="space-y-6">
              <div className="card-surface p-6 rounded-2xl">
                <div className="mb-4">
                  <h2 className="text-h2 font-semibold flex items-center gap-2 text-foreground">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Últimos Movimientos
                  </h2>
                  <p className="text-sm text-muted-foreground">Movimientos importados del banco</p>
                </div>
                {loadingTransactions ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="animate-pulse h-16 bg-card rounded-xl" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center mx-auto mb-3">
                      <span className="text-2xl">📭</span>
                    </div>
                    <p className="font-medium">Sin movimientos</p>
                    <p className="text-sm">Conecta un banco y sincroniza para ver tus movimientos</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {transactions.map((tx) => (
                      <div
                        key={tx._id}
                        className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:bg-card-elevated transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              tx.transaction_type === "ingreso"
                                ? "bg-primary/20 text-primary"
                                : tx.transaction_type === "transferencia"
                                ? "bg-ai/20 text-ai"
                                : "bg-destructive/20 text-destructive"
                            }`}
                          >
                            {tx.transaction_type === "ingreso" ? "↓" : tx.transaction_type === "transferencia" ? "↔" : "↑"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {tx.merchant_name || tx.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(tx.booking_date)}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-semibold text-sm flex-shrink-0 ${
                            tx.amount > 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {tx.amount > 0 ? "+" : ""}{formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Security info */}
              <div className="card-surface p-6 rounded-2xl bg-primary/5 border border-primary/20">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-semibold text-primary">Tu seguridad es prioritaria</h4>
                    <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                      <li className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Nunca almacenamos contraseñas
                      </li>
                      <li className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Autenticación directa con tu banco
                      </li>
                      <li className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Cumple normativa PSD2
                      </li>
                      <li className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Solo lectura de movimientos
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Credentials Dialog */}
      {showCredentialsDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowCredentialsDialog(false)} />
          <div className="relative card-elevated p-6 rounded-2xl w-full max-w-md mx-4">
            <h3 className="text-xl font-bold text-foreground mb-2">Actualizar Credenciales Nordigen</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Introduce tus nuevas credenciales de Nordigen/GoCardless
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Secret ID</label>
                <input
                  type="text"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={secretId}
                  onChange={(e) => setSecretId(e.target.value)}
                  className="mt-1 w-full px-4 py-2 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">Secret Key</label>
                <input
                  type="password"
                  placeholder="••••••••••••••••"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                  className="mt-1 w-full px-4 py-2 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                />
              </div>
              {credentialsError && (
                <p className="text-sm text-destructive">{credentialsError}</p>
              )}
              <div className="flex gap-2 justify-end pt-2">
                <button className="btn-secondary" onClick={() => setShowCredentialsDialog(false)}>
                  Cancelar
                </button>
                <button className="btn-primary" onClick={handleSaveCredentials} disabled={savingCredentials}>
                  {savingCredentials ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
