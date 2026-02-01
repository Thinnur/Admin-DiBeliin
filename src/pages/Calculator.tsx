// =============================================================================
// DiBeliin Admin - Order Calculator Page
// =============================================================================
// Optimize order splitting across multiple accounts for maximum savings

import { useState } from 'react';
import {
    Calculator,
    Sparkles,
    Trash2,
    Plus,
    Copy,
    Check,
    AlertCircle,
    Zap,
    TrendingDown,
    Users,
    Receipt,
    Loader2,
    X,
    Phone,
    Key,
    CheckCircle2,
    XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import {
    parseWhatsAppOrder,
    formatPrice,
    getSampleOrderText,
    type ParsedItem,
} from '@/lib/logic/orderParser';
import {
    optimizeOrder,
    type CartItem,
    type OptimizationResult,
} from '@/lib/logic/optimizer';
import {
    useExecuteOrder,
    generateCompactReport,
    type ExecutionResult,
} from '@/hooks/useExecuteOrder';
import type { AccountBrand } from '@/types/database';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface EditableItem extends ParsedItem {
    id: string;
}

// -----------------------------------------------------------------------------
// Item Row Component
// -----------------------------------------------------------------------------

function ItemRow({
    item,
    onUpdate,
    onDelete,
}: {
    item: EditableItem;
    onUpdate: (id: string, updates: Partial<EditableItem>) => void;
    onDelete: (id: string) => void;
}) {
    return (
        <tr className="border-b border-slate-100 hover:bg-slate-50/50">
            <td className="py-2 px-2">
                <Input
                    value={item.name}
                    onChange={(e) => onUpdate(item.id, { name: e.target.value })}
                    className="h-8 text-sm"
                />
            </td>
            <td className="py-2 px-2 w-20">
                <Input
                    type="number"
                    min="1"
                    value={item.qty}
                    onChange={(e) => onUpdate(item.id, { qty: parseInt(e.target.value) || 1 })}
                    className="h-8 text-sm text-center"
                />
            </td>
            <td className="py-2 px-2 w-28">
                <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={item.price}
                    onChange={(e) => onUpdate(item.id, { price: parseInt(e.target.value) || 0 })}
                    className={`h-8 text-sm text-right ${item.hasError ? 'border-amber-400 bg-amber-50' : ''}`}
                />
            </td>
            <td className="py-2 px-2 w-24 text-right">
                <span className="text-sm font-medium text-slate-700">
                    {formatPrice(item.price * item.qty)}
                </span>
            </td>
            <td className="py-2 px-2 w-12">
                <button
                    onClick={() => onDelete(item.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </td>
        </tr>
    );
}

// -----------------------------------------------------------------------------
// Strategy Card Component
// -----------------------------------------------------------------------------

function StrategyCard({
    group,
    index,
}: {
    group: OptimizationResult['groups'][0];
    index: number;
}) {
    const voucherLabel = group.recommendedVoucher === 'nomin' ? 'No Min' : 'Min 50k';
    const voucherColor = group.recommendedVoucher === 'nomin'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-blue-50 text-blue-700 border-blue-200';

    return (
        <Card className="shadow-sm">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                        Group {index + 1}
                    </CardTitle>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${voucherColor}`}>
                        {voucherLabel}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="space-y-1.5">
                    {group.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-600 truncate pr-2">{item.name}</span>
                            <span className="text-slate-900 font-medium tabular-nums">
                                {formatPrice(item.price)}
                            </span>
                        </div>
                    ))}
                </div>
                <div className="pt-2 border-t border-slate-100 space-y-1">
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="font-medium">{formatPrice(group.totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-600">
                        <span>Discount</span>
                        <span className="font-semibold">-{formatPrice(group.estimatedDiscount)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Summary Card Component
// -----------------------------------------------------------------------------

function SummaryCard({ result }: { result: OptimizationResult }) {
    const savingsPercent = result.totalBill > 0
        ? Math.round(((result.totalDiscount - result.totalAdminCost) / result.totalBill) * 100)
        : 0;

    return (
        <Card className="shadow-sm bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="w-5 h-5" />
                    Summary
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-white/10">
                        <div className="flex items-center gap-2 text-slate-300 text-xs mb-1">
                            <Calculator className="w-3.5 h-3.5" />
                            Total Bill
                        </div>
                        <div className="text-lg font-bold">{formatPrice(result.totalBill)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-emerald-500/20">
                        <div className="flex items-center gap-2 text-emerald-300 text-xs mb-1">
                            <TrendingDown className="w-3.5 h-3.5" />
                            Total Discount
                        </div>
                        <div className="text-lg font-bold text-emerald-400">
                            -{formatPrice(result.totalDiscount)}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/20">
                        <div className="flex items-center gap-2 text-amber-300 text-xs mb-1">
                            <Users className="w-3.5 h-3.5" />
                            Admin Cost ({result.accountsNeeded} acc)
                        </div>
                        <div className="text-lg font-bold text-amber-400">
                            +{formatPrice(result.totalAdminCost)}
                        </div>
                    </div>
                    <div className="p-3 rounded-lg bg-white/10">
                        <div className="flex items-center gap-2 text-slate-300 text-xs mb-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            Net Savings
                        </div>
                        <div className="text-lg font-bold text-emerald-400">
                            {savingsPercent}%
                        </div>
                    </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                    <div className="flex justify-between items-center">
                        <span className="text-slate-300">Final Price</span>
                        <span className="text-2xl font-bold">{formatPrice(result.finalPrice)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function CalculatorPage() {
    // Input state
    const [orderText, setOrderText] = useState('');
    const [items, setItems] = useState<EditableItem[]>([]);
    const [brand, setBrand] = useState<AccountBrand>('kopken');
    const [adminCost, setAdminCost] = useState(5000);

    // Result state
    const [result, setResult] = useState<OptimizationResult | null>(null);
    const [hasOptimized, setHasOptimized] = useState(false);

    // Execution state
    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
    const [showSuccessDialog, setShowSuccessDialog] = useState(false);
    const executeOrder = useExecuteOrder();

    // Generate unique ID
    const generateId = () => Math.random().toString(36).substring(2, 9);

    // Parse order text
    const handleParse = () => {
        const parsed = parseWhatsAppOrder(orderText);

        if (parsed.items.length === 0) {
            toast.error('No items could be parsed. Please check the format.');
            return;
        }

        const editableItems: EditableItem[] = parsed.items.map((item) => ({
            ...item,
            id: generateId(),
        }));

        setItems(editableItems);
        setResult(null);
        setHasOptimized(false);

        const errorCount = parsed.items.filter((i) => i.hasError).length;
        if (errorCount > 0) {
            toast.warning(`${parsed.totalParsed} items parsed. ${errorCount} item(s) need price input.`);
        } else {
            toast.success(`${parsed.totalParsed} items parsed successfully!`);
        }
    };

    // Load sample order
    const handleLoadSample = () => {
        setOrderText(getSampleOrderText());
        toast.info('Sample order loaded. Click Parse to continue.');
    };

    // Update item
    const handleUpdateItem = (id: string, updates: Partial<EditableItem>) => {
        setItems((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, ...updates, hasError: false } : item
            )
        );
        setHasOptimized(false);
    };

    // Delete item
    const handleDeleteItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        setHasOptimized(false);
    };

    // Add new item
    const handleAddItem = () => {
        const newItem: EditableItem = {
            id: generateId(),
            name: 'New Item',
            price: 0,
            qty: 1,
            rawLine: '',
            hasError: true,
            errorMessage: 'Please fill in details',
        };
        setItems((prev) => [...prev, newItem]);
        setHasOptimized(false);
    };

    // Clear all
    const handleClear = () => {
        setOrderText('');
        setItems([]);
        setResult(null);
        setHasOptimized(false);
    };

    // Optimize order
    const handleOptimize = () => {
        if (items.length === 0) {
            toast.error('No items to optimize. Parse an order first.');
            return;
        }

        // Check for items with 0 price
        const zeroPriceItems = items.filter((i) => i.price === 0);
        if (zeroPriceItems.length > 0) {
            toast.warning(`${zeroPriceItems.length} item(s) have 0 price. Please update before optimizing.`);
            return;
        }

        const cartItems: CartItem[] = items.map((item) => ({
            name: item.name,
            price: item.price,
            qty: item.qty,
        }));

        const optimizationResult = optimizeOrder(cartItems, brand, adminCost);
        setResult(optimizationResult);
        setHasOptimized(true);

        toast.success(`Optimized into ${optimizationResult.accountsNeeded} group(s)!`);
    };

    // Execute strategy
    const handleExecute = async () => {
        if (!result) return;

        try {
            const execResult = await executeOrder.mutateAsync({
                groups: result.groups,
                brand,
            });

            setExecutionResult(execResult);
            setShowSuccessDialog(true);

            // If fully successful, reset the calculator
            if (execResult.success) {
                setItems([]);
                setResult(null);
                setHasOptimized(false);
                setOrderText('');
            }
        } catch (error) {
            // Error is handled by the hook
            console.error('Execution failed:', error);
        }
    };

    // Copy execution result
    const handleCopyExecutionResult = () => {
        if (!executionResult) return;

        const report = generateCompactReport(executionResult);
        navigator.clipboard.writeText(report);
        toast.success('Account details copied to clipboard!');
    };

    // Copy result
    const handleCopyResult = () => {
        if (!result) return;

        const text = result.groups
            .map((g, i) => {
                const items = g.items.map((item) => `  - ${item.name}: ${formatPrice(item.price)}`).join('\n');
                return `Group ${i + 1} (${g.recommendedVoucher === 'nomin' ? 'No Min' : 'Min 50k'}):\n${items}\n  Subtotal: ${formatPrice(g.totalPrice)}\n  Discount: -${formatPrice(g.estimatedDiscount)}`;
            })
            .join('\n\n');

        const summary = `\n---\nTotal: ${formatPrice(result.totalBill)}\nDiscount: -${formatPrice(result.totalDiscount)}\nAdmin Cost: +${formatPrice(result.totalAdminCost)}\nFinal: ${formatPrice(result.finalPrice)}`;

        navigator.clipboard.writeText(text + summary);
        toast.success('Strategy copied to clipboard!');
    };

    // Calculate totals
    const totalItems = items.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-semibold text-slate-900">Order Calculator</h1>
                    <p className="text-sm text-slate-500">
                        Optimize bill splitting for maximum voucher savings
                    </p>
                </div>
                {items.length > 0 && (
                    <Button variant="outline" size="sm" onClick={handleClear}>
                        Clear All
                    </Button>
                )}
            </div>

            {/* Two Column Layout */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Left Column - Input */}
                <div className="space-y-4">
                    {/* Parse Section */}
                    <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Calculator className="w-4 h-4" />
                                Order Input
                            </CardTitle>
                            <CardDescription>
                                Paste WhatsApp order or type manually
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <textarea
                                    value={orderText}
                                    onChange={(e) => setOrderText(e.target.value)}
                                    placeholder="Paste WhatsApp order here...

Example:
2 Es Kopi Susu 18.000
1 Americano 22k
3x Kopi Kenangan Mantan 18000"
                                    className="w-full h-32 p-3 text-sm border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={handleParse} disabled={!orderText.trim()}>
                                    <Zap className="w-4 h-4 mr-2" />
                                    Parse
                                </Button>
                                <Button variant="outline" onClick={handleLoadSample}>
                                    Load Sample
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Items Table */}
                    {items.length > 0 && (
                        <Card className="shadow-sm">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">
                                        Items ({totalItems})
                                    </CardTitle>
                                    <Button variant="ghost" size="sm" onClick={handleAddItem}>
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="text-xs text-slate-500 border-b">
                                                <th className="text-left py-2 px-2 font-medium">Name</th>
                                                <th className="text-center py-2 px-2 font-medium w-20">Qty</th>
                                                <th className="text-right py-2 px-2 font-medium w-28">Price</th>
                                                <th className="text-right py-2 px-2 font-medium w-24">Total</th>
                                                <th className="w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {items.map((item) => (
                                                <ItemRow
                                                    key={item.id}
                                                    item={item}
                                                    onUpdate={handleUpdateItem}
                                                    onDelete={handleDeleteItem}
                                                />
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="border-t-2 border-slate-200">
                                                <td colSpan={3} className="py-3 px-2 text-sm font-medium text-slate-700">
                                                    Grand Total
                                                </td>
                                                <td className="py-3 px-2 text-right text-base font-bold text-slate-900">
                                                    {formatPrice(totalPrice)}
                                                </td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Warnings */}
                                {items.some((i) => i.hasError) && (
                                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                                        <p className="text-sm text-amber-700">
                                            Some items need price input. Please fill in before optimizing.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Settings & Optimize */}
                    {items.length > 0 && (
                        <Card className="shadow-sm">
                            <CardContent className="pt-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="brand">Brand</Label>
                                        <Select value={brand} onValueChange={(v) => setBrand(v as AccountBrand)}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="kopken">Kopi Kenangan</SelectItem>
                                                <SelectItem value="fore">Fore Coffee</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="adminCost">Admin Cost (per account)</Label>
                                        <Input
                                            id="adminCost"
                                            type="number"
                                            min="0"
                                            step="1000"
                                            value={adminCost}
                                            onChange={(e) => setAdminCost(parseInt(e.target.value) || 0)}
                                        />
                                    </div>
                                </div>

                                <Button
                                    onClick={handleOptimize}
                                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                                    size="lg"
                                >
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Optimize Order
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column - Results */}
                <div className="space-y-4">
                    {!hasOptimized && items.length === 0 && (
                        <div className="h-96 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-xl">
                            <Calculator className="w-12 h-12 text-slate-300 mb-4" />
                            <h3 className="text-lg font-medium text-slate-600 mb-2">
                                No Order Yet
                            </h3>
                            <p className="text-sm text-slate-400 max-w-xs">
                                Paste a WhatsApp order on the left and click Parse to get started.
                            </p>
                        </div>
                    )}

                    {!hasOptimized && items.length > 0 && (
                        <div className="h-96 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50/30">
                            <Sparkles className="w-12 h-12 text-amber-400 mb-4" />
                            <h3 className="text-lg font-medium text-slate-700 mb-2">
                                Ready to Optimize
                            </h3>
                            <p className="text-sm text-slate-500 max-w-xs">
                                Review the items, set your preferences, then click "Optimize Order" to see the best strategy.
                            </p>
                        </div>
                    )}

                    {hasOptimized && result && (
                        <>
                            {/* Summary */}
                            <SummaryCard result={result} />

                            {/* Strategy Cards */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                                    <Zap className="w-4 h-4" />
                                    Strategy ({result.groups.length} groups)
                                </h3>
                                {result.groups.map((group, index) => (
                                    <StrategyCard key={group.id} group={group} index={index} />
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-2">
                                <Button
                                    onClick={handleExecute}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                                    disabled={executeOrder.isPending}
                                >
                                    {executeOrder.isPending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Allocating...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4 mr-2" />
                                            Execute Strategy
                                        </>
                                    )}
                                </Button>
                                <Button variant="outline" onClick={handleCopyResult}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Success Dialog */}
            <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {executionResult?.success ? (
                                <>
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    Order Executed!
                                </>
                            ) : (
                                <>
                                    <XCircle className="w-5 h-5 text-amber-500" />
                                    Partial Execution
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {executionResult?.success
                                ? 'All accounts have been assigned successfully.'
                                : `${executionResult?.assignedAccounts.length}/${executionResult?.summary.totalGroups} groups assigned.`}
                        </DialogDescription>
                    </DialogHeader>

                    {executionResult && (
                        <div className="space-y-4 mt-2">
                            {/* Assigned Accounts */}
                            {executionResult.assignedAccounts.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-slate-700">
                                        Accounts to Use:
                                    </h4>
                                    <div className="space-y-2 max-h-64 overflow-y-auto">
                                        {executionResult.assignedAccounts.map((assignment) => (
                                            <div
                                                key={assignment.account.id}
                                                className="p-3 bg-slate-50 rounded-lg border"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                                                        Group {assignment.groupId}
                                                    </span>
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${assignment.voucherType === 'nomin'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {assignment.voucherType === 'nomin' ? 'No Min' : 'Min 50k'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm mt-2">
                                                    <Phone className="w-4 h-4 text-slate-400" />
                                                    <span className="font-medium">{assignment.account.phone_number}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm mt-1">
                                                    <Key className="w-4 h-4 text-slate-400" />
                                                    <span className="font-mono text-slate-600">{assignment.account.password}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Errors */}
                            {executionResult.errors.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium text-red-600">
                                        Failed Groups:
                                    </h4>
                                    <div className="space-y-1">
                                        {executionResult.errors.map((err, index) => (
                                            <div key={index} className="p-2 bg-red-50 rounded text-sm text-red-700">
                                                <span className="font-medium">Group {err.groupId}:</span> {err.message}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 pt-2">
                                <Button
                                    onClick={handleCopyExecutionResult}
                                    variant="outline"
                                    className="flex-1"
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy Account Details
                                </Button>
                                <Button
                                    onClick={() => setShowSuccessDialog(false)}
                                    className="flex-1"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
