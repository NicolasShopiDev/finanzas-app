import { BankTransaction, Category } from "@/types/database";

interface PendingTransactionItemProps {
    transaction: BankTransaction;
    categories: Category[];
    isSelected: boolean;
    isBulkMode: boolean;
    isSaving: boolean;
    hasPrediction: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    prediction: any;
    selectedProxyCategory: string; // The category currently selected in the dropdown (local state in parent)
    onToggleSelect: (id: string) => void;
    onCategorySelectChange: (id: string, categoryId: string) => void;
    onAssign: (id: string) => void;
    onSkip: (id: string) => void;
}

export function PendingTransactionItem({
    transaction,
    categories,
    isSelected,
    isBulkMode,
    isSaving,
    hasPrediction,
    prediction,
    selectedProxyCategory,
    onToggleSelect,
    onCategorySelectChange,
    onAssign,
    onSkip,
}: PendingTransactionItemProps) {
    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-ES", {
            style: "currency",
            currency: "EUR",
        }).format(amount);
    };

    // Format date
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    };

    // Get confidence badge class
    const getConfidenceBadgeClass = (confidence: "alta" | "media" | "baja") => {
        switch (confidence) {
            case "alta":
                return "badge-primary";
            case "media":
                return "badge-warning";
            case "baja":
                return "bg-card border border-border text-muted-foreground";
        }
    };

    return (
        <div
            className={`card-surface p-4 rounded-2xl transition-all duration-200 hover:shadow-lg ${isBulkMode && isSelected
                    ? "border-2 border-primary bg-primary/5"
                    : hasPrediction
                        ? "border border-ai/30 bg-ai/5"
                        : "border border-border hover:border-primary/50"
                }`}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Checkbox for bulk mode */}
                    {isBulkMode && (
                        <button
                            onClick={() => onToggleSelect(transaction._id)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all flex-shrink-0 ${isSelected
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border hover:border-primary"
                                }`}
                        >
                            {isSelected && (
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={3}
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            )}
                        </button>
                    )}

                    {/* Transaction icon */}
                    <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${transaction.transaction_type === "ingreso"
                                ? "bg-primary/20 text-primary"
                                : transaction.transaction_type === "transferencia"
                                    ? "bg-ai/20 text-ai"
                                    : "bg-destructive/20 text-destructive"
                            }`}
                    >
                        {transaction.transaction_type === "ingreso" ? (
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                />
                            </svg>
                        ) : transaction.transaction_type === "transferencia" ? (
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                />
                            </svg>
                        ) : (
                            <svg
                                className="w-6 h-6"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 10l7-7m0 0l7 7m-7-7v18"
                                />
                            </svg>
                        )}
                    </div>

                    {/* Transaction details */}
                    <div className="flex-grow min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <h3 className="font-semibold text-foreground truncate">
                                {transaction.merchant_name ||
                                    transaction.description ||
                                    "Sin descripción"}
                            </h3>
                            <span
                                className={`font-bold text-lg ${transaction.amount > 0 ? "text-primary" : "text-destructive"
                                    }`}
                            >
                                {transaction.amount > 0 ? "+" : ""}
                                {formatCurrency(transaction.amount)}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                                {formatDate(transaction.booking_date)}
                            </span>
                            <span className="badge bg-card border border-border text-muted-foreground">
                                {transaction.transaction_type}
                            </span>
                            {transaction.description &&
                                transaction.merchant_name &&
                                transaction.description !== transaction.merchant_name && (
                                    <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                        {transaction.description}
                                    </span>
                                )}
                        </div>
                    </div>

                    {/* Category selection (only in non-bulk mode) */}
                    {!isBulkMode && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <select
                                value={selectedProxyCategory || ""}
                                onChange={(e) =>
                                    onCategorySelectChange(transaction._id, e.target.value)
                                }
                                className={`px-3 py-2 rounded-xl bg-card border text-foreground focus:ring-2 focus:ring-primary focus:border-primary transition-all min-w-[180px] ${hasPrediction ? "border-ai" : "border-border"
                                    }`}
                                disabled={isSaving}
                            >
                                <option value="">Seleccionar categoría...</option>
                                {categories.map((cat) => (
                                    <option key={cat._id} value={cat._id}>
                                        {cat.icon} {cat.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                onClick={() => onAssign(transaction._id)}
                                disabled={isSaving || !selectedProxyCategory}
                                className="p-2 btn-primary"
                            >
                                {isSaving ? (
                                    <svg
                                        className="animate-spin h-4 w-4"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                    >
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                )}
                            </button>
                            <button
                                onClick={() => onSkip(transaction._id)}
                                disabled={isSaving}
                                className="p-2 text-muted-foreground hover:text-foreground hover:bg-card rounded-xl transition-colors"
                                title="Marcar como revisado sin categoría"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                                    />
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

                {/* AI Suggestion */}
                {hasPrediction && !isBulkMode && (
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-ai/10 border border-ai/20">
                        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-ai/20 flex items-center justify-center">
                            <svg
                                className="w-4 h-4 text-ai"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                                />
                            </svg>
                        </div>
                        <div className="flex-grow min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-foreground">
                                    Sugerencia IA:
                                </span>
                                <span className="badge badge-ai">
                                    {prediction.suggestedCategoryName}
                                </span>
                                <span
                                    className={`badge text-xs ${getConfidenceBadgeClass(
                                        prediction.confidence
                                    )}`}
                                >
                                    Confianza {prediction.confidence}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {prediction.reasoning}
                            </p>
                        </div>
                        <button
                            onClick={() => onAssign(transaction._id)}
                            disabled={isSaving}
                            className="px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors border border-primary/20"
                        >
                            Aplicar
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
