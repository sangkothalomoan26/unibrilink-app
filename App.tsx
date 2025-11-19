
import React, { useState, useCallback, useRef, useMemo } from 'react';
// Fix: Import xlsx library to fix 'XLSX' not defined error.
import * as XLSX from 'xlsx';
// Fix: Import Clipboard icon from lucide-react to fix 'LucideReact' not existing on window.
import { Clipboard, History } from 'lucide-react';
import { useVoucherStore } from './hooks/useVoucherStore';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { Dashboard } from './components/dashboard/Dashboard';
import { ProviderView } from './components/provider/ProviderView';
import { SalesView } from './components/sales/SalesView';
import { Modal } from './components/common/Modal';
import { Toast } from './components/common/Toast';
import { generateCompleteReport, generateShortReport, generateCompleteReceiptHTML, generateShortReceiptHTML } from './utils/reportGenerator';
import { calculateAutoSellPrice, formatCurrency, formatNumberWithSeparators, parseFormattedNumber } from './utils/helpers';
import type { Provider, Voucher, ToastMessage, ActivityLog } from './types';

const VOUCHER_FORM_DEFAULTS: Omit<Voucher, 'id' | 'providerId' | 'name'> = {
    totalStock: 0,
    remainingStock: 0,
    costPrice: 0,
    sellPrice: 0,
    plannedStock: 0,
};

const App: React.FC = () => {
    const [theme, toggleTheme] = useTheme();
    const { providers, vouchers, addProvider, deleteProvider, upsertVoucher, updateVoucher, deleteVoucher, activityLogs, addLog } = useVoucherStore();
    
    const [currentView, setCurrentView] = useState<'dashboard' | 'provider' | 'sales'>('dashboard');
    const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);

    // Modal States
    const [isVoucherFormOpen, setIsVoucherFormOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState<Voucher | null>(null);
    const [voucherFormData, setVoucherFormData] = useState<Partial<Voucher>>({});

    const [isAddProviderModalOpen, setIsAddProviderModalOpen] = useState(false);
    
    const [deletingVoucher, setDeletingVoucher] = useState<Voucher | null>(null);
    const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null);

    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportContent, setReportContent] = useState('');
    const [reportTitle, setReportTitle] = useState('');
    
    const [stockToAdd, setStockToAdd] = useState<{voucher: Voucher | null, quantity: string}>({ voucher: null, quantity: ''});

    const [isPrintChoiceModalOpen, setIsPrintChoiceModalOpen] = useState(false);
    
    const [isActivityLogOpen, setIsActivityLogOpen] = useState(false);

    const [toasts, setToasts] = useState<ToastMessage[]>([]);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Autocomplete state
    const allVoucherNames = useMemo(() => {
        const gbs: string[] = [];
        for (let i = 1; i <= 15; i += 0.5) {
            const gbString = Number.isInteger(i) ? i.toString() : i.toString();
            gbs.push(`${gbString}GB`);
        }
        const days = [1, 2, 3, 5, 7, 10, 14, 30];
        const suggestions: string[] = [];
        gbs.forEach(gb => {
            days.forEach(day => {
                suggestions.push(`${gb} / ${day} Hari`);
            });
        });
        return suggestions;
    }, []);
    const [voucherNameSuggestions, setVoucherNameSuggestions] = useState<string[]>([]);


    const addToast = useCallback((type: ToastMessage['type'], message: string) => {
        setToasts(prev => [...prev, { id: Date.now(), type, message }]);
    }, []);
    
    const dismissToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const handleSelectProvider = (id: number) => {
        setSelectedProviderId(id);
        setCurrentView('provider');
    };
    const handleBackToDashboard = () => {
        setSelectedProviderId(null);
        setCurrentView('dashboard');
    };
    const handleGoToSales = () => setCurrentView('sales');
    
    const handleOpenAddVoucher = (providerId: number) => {
        setEditingVoucher(null);
        setVoucherFormData({ providerId, ...VOUCHER_FORM_DEFAULTS });
        setIsVoucherFormOpen(true);
    };

    const handleOpenEditVoucher = (voucher: Voucher) => {
        setEditingVoucher(voucher);
        setVoucherFormData(voucher);
        setIsVoucherFormOpen(true);
    };
    
    const handleVoucherFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        if (name === 'name') {
            if (value.trim()) {
                const filtered = allVoucherNames.filter(suggestion =>
                    suggestion.toLowerCase().includes(value.toLowerCase())
                );
                setVoucherNameSuggestions(filtered.slice(0, 5));
            } else {
                setVoucherNameSuggestions([]);
            }
        }

        setVoucherFormData(prev => {
            const newFormData = { ...prev };
            const isNumeric = ['costPrice', 'sellPrice', 'totalStock', 'remainingStock', 'plannedStock'].includes(name);

            if (isNumeric) {
                const parsedValue = parseFormattedNumber(value);
                newFormData[name as keyof Voucher] = parsedValue;
            } else {
                newFormData[name as keyof Voucher] = value as string;
            }

            // Corrected: Always calculate sell price when cost price changes
            if (name === 'costPrice') {
                const cost = newFormData.costPrice || 0;
                newFormData.sellPrice = calculateAutoSellPrice(cost);
            }
            
            return newFormData;
        });
    };

    const handleSuggestionClick = (suggestion: string) => {
        setVoucherFormData(prev => ({ ...prev, name: suggestion }));
        setVoucherNameSuggestions([]);
    };

    const handleVoucherFormSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const finalData: Omit<Voucher, 'id'> = {
            providerId: voucherFormData.providerId!,
            name: voucherFormData.name!,
            totalStock: voucherFormData.totalStock!,
            remainingStock: voucherFormData.remainingStock!,
            costPrice: voucherFormData.costPrice!,
            sellPrice: voucherFormData.sellPrice!,
            plannedStock: voucherFormData.plannedStock!
        };
        
        upsertVoucher(finalData);
        const logMessage = editingVoucher
            ? `Voucher "${finalData.name}" diperbarui.`
            : `Voucher "${finalData.name}" ditambahkan.`;
        addLog('EDIT', logMessage);
        addToast('success', `Voucher "${finalData.name}" berhasil ${editingVoucher ? 'diperbarui' : 'ditambahkan'}.`);
        setIsVoucherFormOpen(false);
        setVoucherNameSuggestions([]);
    };
    
    const handleAddProviderSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('providerName') as string;
        const logoUrl = formData.get('providerLogoUrl') as string;
        const nextId = providers.length > 0 ? Math.max(...providers.map(p => p.id)) + 1 : 1;
        addProvider({ id: nextId, name, logoUrl: logoUrl || undefined });
        addToast('success', `Provider "${name}" berhasil ditambahkan.`);
        setIsAddProviderModalOpen(false);
    };

    const confirmDeleteVoucher = () => {
        if (deletingVoucher) {
            deleteVoucher(deletingVoucher.id);
            addLog('DELETE_VOUCHER', `Voucher "${deletingVoucher.name}" dihapus.`);
            addToast('success', `Voucher "${deletingVoucher.name}" berhasil dihapus.`);
            setDeletingVoucher(null);
        }
    };
    
    const confirmDeleteProvider = () => {
        if(deletingProvider) {
            deleteProvider(deletingProvider.id);
            addLog('DELETE_PROVIDER', `Provider "${deletingProvider.name}" dan semua vouchernya dihapus.`);
            addToast('success', `Provider "${deletingProvider.name}" dan semua vouchernya berhasil dihapus.`);
            setDeletingProvider(null);
            setCurrentView('dashboard');
            setSelectedProviderId(null);
        }
    }
    
    const handleConfirmAddStock = () => {
        if (!stockToAdd.voucher || !stockToAdd.quantity) return;
        const quantity = parseInt(stockToAdd.quantity, 10);
        if (isNaN(quantity) || quantity <= 0) return;

        const updatedVoucher = { ...stockToAdd.voucher };
        updatedVoucher.totalStock += quantity;
        updatedVoucher.remainingStock += quantity;
        updatedVoucher.plannedStock = Math.max(0, updatedVoucher.plannedStock - quantity);
        
        updateVoucher(updatedVoucher);
        addLog('ADD_STOCK', `${quantity} stok ditambahkan ke "${updatedVoucher.name}".`);
        addToast('success', `${quantity} stok berhasil ditambahkan ke "${updatedVoucher.name}".`);
        setStockToAdd({ voucher: null, quantity: ''});
    };

    const handleCompleteSale = (cart: Record<string, number>) => {
        let totalSalePrice = 0;
        const saleDetails: string[] = [];
        const updatedVouchers: Voucher[] = [];

        Object.entries(cart).forEach(([voucherId, quantity]) => {
            const voucher = vouchers.find(v => v.id === voucherId);
            if (voucher && voucher.remainingStock >= quantity) {
                const updatedVoucher = {
                    ...voucher,
                    remainingStock: voucher.remainingStock - quantity,
                };
                updatedVouchers.push(updatedVoucher);
                totalSalePrice += voucher.sellPrice * quantity;
                saleDetails.push(`${quantity}x ${voucher.name}`);
            }
        });
        
        if (updatedVouchers.length > 0) {
            updatedVouchers.forEach(v => updateVoucher(v));
            const logMessage = `Penjualan: ${saleDetails.join(', ')} | Total: ${formatCurrency(totalSalePrice)}.`;
            addLog('SALE', logMessage);
            addToast('success', 'Penjualan berhasil!');
            setCurrentView('dashboard');
        } else {
            addToast('error', 'Gagal memproses penjualan.');
        }
    };

    const handleGenerateReport = (type: 'complete' | 'short') => {
        if (type === 'complete') {
            setReportTitle('Laporan Lengkap');
            setReportContent(generateCompleteReport(providers, vouchers));
        } else {
            setReportTitle('Laporan Singkat');
            setReportContent(generateShortReport(providers, vouchers));
        }
        setIsReportModalOpen(true);
    };
    
    const copyReportToClipboard = () => {
        navigator.clipboard.writeText(reportContent);
        addToast('success', 'Laporan berhasil disalin ke clipboard.');
    };

    const handlePrintReceipt = useCallback(() => {
        setIsPrintChoiceModalOpen(true);
    }, []);

    const handlePrintSelectedReceipt = useCallback((type: 'complete' | 'short') => {
        setIsPrintChoiceModalOpen(false);
        
        const receiptHtml = type === 'complete' 
            ? generateCompleteReceiptHTML(providers, vouchers)
            : generateShortReceiptHTML(providers, vouchers);

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(receiptHtml);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            addToast('info', 'Pilih printer thermal Anda dari jendela cetak.');
        } else {
            addToast('error', 'Gagal membuka jendela cetak. Pastikan pop-up diizinkan.');
        }
    }, [providers, vouchers, addToast]);


    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: (string|number)[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                let successCount = 0;
                const errorLog: string[] = [];

                json.slice(1).forEach((row, index) => {
                    if (row.length === 0) return; // Skip empty rows

                    const [providerId, name, totalStock, remainingStock, costPrice, sellPrice, plannedStock] = row;

                    if (!providerId || !name) {
                        errorLog.push(`Baris ${index + 2}: ID Provider dan Nama Voucher wajib diisi.`);
                        return;
                    }

                    const parsedProviderId = Number(providerId);
                    if (isNaN(parsedProviderId)) {
                        errorLog.push(`Baris ${index + 2}: ID Provider harus berupa angka.`);
                        return;
                    }
                    
                    let provider = providers.find(p => p.id === parsedProviderId);
                    if (!provider) {
                        const newProviderName = `Provider ${parsedProviderId}`;
                        addProvider({ id: parsedProviderId, name: newProviderName });
                        addToast('info', `Provider baru "${newProviderName}" dibuat otomatis.`);
                    }
                    
                    const parsedCostPrice = Number(costPrice);
                    const finalSellPrice = (sellPrice !== null && sellPrice !== '' && !isNaN(Number(sellPrice))) 
                        ? Number(sellPrice) 
                        : calculateAutoSellPrice(parsedCostPrice);

                    const voucherData: Omit<Voucher, 'id'> = {
                        providerId: parsedProviderId,
                        name: String(name),
                        totalStock: Number(totalStock || 0),
                        remainingStock: Number(remainingStock || totalStock || 0),
                        costPrice: parsedCostPrice || 0,
                        sellPrice: finalSellPrice,
                        plannedStock: Number(plannedStock || 0)
                    };
                    
                    upsertVoucher(voucherData);
                    successCount++;
                });

                if (successCount > 0) {
                    addLog('IMPORT', `Mengimpor/memperbarui ${successCount} voucher dari file Excel.`);
                    addToast('success', `${successCount} data voucher berhasil diimpor/diperbarui.`);
                }
                if (errorLog.length > 0) {
                    addToast('error', `Terjadi ${errorLog.length} kesalahan saat impor. Periksa konsol untuk detail.`);
                    console.error("Kesalahan Impor Excel:\n" + errorLog.join('\n'));
                }

            } catch (err) {
                console.error(err);
                addToast('error', 'Gagal memproses file Excel.');
            }
        };
        reader.readAsArrayBuffer(file);
        event.target.value = ''; // Reset input
    };

    const selectedProvider = providers.find(p => p.id === selectedProviderId);
    const estimatedPlannedCost = (voucherFormData.plannedStock || 0) * (voucherFormData.costPrice || 0);

    const renderContent = () => {
        switch(currentView) {
            case 'provider':
                return selectedProvider ? (
                    <ProviderView 
                        provider={selectedProvider} 
                        vouchers={vouchers.filter(v => v.providerId === selectedProviderId)}
                        onBack={handleBackToDashboard}
                        onAddVoucher={handleOpenAddVoucher}
                        onEditVoucher={handleOpenEditVoucher}
                        onDeleteVoucher={(v) => setDeletingVoucher(v)}
                        onDeleteProvider={(p) => setDeletingProvider(p)}
                        onAddStock={(v) => setStockToAdd({ voucher: v, quantity: '' })}
                    />
                ) : null;
            case 'sales':
                return <SalesView providers={providers} vouchers={vouchers} onBack={handleBackToDashboard} onCompleteSale={handleCompleteSale} />;
            case 'dashboard':
            default:
                return (
                    <Dashboard 
                        providers={providers}
                        vouchers={vouchers}
                        onSelectProvider={handleSelectProvider} 
                        onUploadClick={handleUploadClick}
                        onAddProviderClick={() => setIsAddProviderModalOpen(true)}
                        onGoToSales={handleGoToSales}
                    />
                );
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-light-bg dark:bg-dark-bg text-gray-800 dark:text-gray-200 transition-colors duration-300">
            <Header theme={theme} toggleTheme={toggleTheme} onGenerateReport={handleGenerateReport} onPrintReceipt={handlePrintReceipt} onShowHistory={() => setIsActivityLogOpen(true)} />
            <main className="flex-grow container mx-auto p-4 md:p-8">
                {renderContent()}
            </main>
            <Footer />
            
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />

            {/* Voucher Add/Edit Modal */}
            <Modal isOpen={isVoucherFormOpen} onClose={() => { setIsVoucherFormOpen(false); setVoucherNameSuggestions([]); }} title={editingVoucher ? 'Edit Voucher' : 'Tambah Voucher Baru'}>
                <form onSubmit={handleVoucherFormSubmit} className="space-y-4">
                    <input type="hidden" name="providerId" value={voucherFormData.providerId} />
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Voucher</label>
                        <input 
                            name="name" 
                            value={voucherFormData.name || ''} 
                            onChange={handleVoucherFormChange}
                            onBlur={() => setTimeout(() => setVoucherNameSuggestions([]), 200)} // Delay to allow click
                            autoComplete="off"
                            required 
                            className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" 
                        />
                        {voucherNameSuggestions.length > 0 && (
                            <ul className="absolute z-10 w-full mt-1 bg-light-card dark:bg-navy-700 border border-gray-300 dark:border-navy-800 rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {voucherNameSuggestions.map(suggestion => (
                                    <li 
                                        key={suggestion}
                                        onMouseDown={() => handleSuggestionClick(suggestion)}
                                        className="px-4 py-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-navy-800"
                                    >
                                        {suggestion}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium">Total Stok</label>
                            <input name="totalStock" type="number" value={voucherFormData.totalStock || ''} onChange={handleVoucherFormChange} required className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Sisa Stok</label>
                            <input name="remainingStock" type="number" value={voucherFormData.remainingStock || ''} onChange={handleVoucherFormChange} required className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
                        </div>
                         <div>
                            <label className="block text-sm font-medium">Harga Modal</label>
                            <input name="costPrice" value={formatNumberWithSeparators(voucherFormData.costPrice || '')} onChange={handleVoucherFormChange} required className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Harga Jual</label>
                            <input name="sellPrice" value={formatNumberWithSeparators(voucherFormData.sellPrice || '')} onChange={handleVoucherFormChange} required className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-sm font-medium">Rencana Tambah Stok</label>
                            <input name="plannedStock" type="number" value={voucherFormData.plannedStock || ''} onChange={handleVoucherFormChange} className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
                            {estimatedPlannedCost > 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Estimasi biaya modal tambahan: <strong>{formatCurrency(estimatedPlannedCost)}</strong></p>
                            )}
                        </div>
                    </div>
                    <div className="pt-4 flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-gold-500 text-navy-900 font-bold rounded-lg shadow-md hover:bg-gold-600 hover:shadow-soft-glow transition-all">Simpan</button>
                    </div>
                </form>
            </Modal>
            
            {/* Add Provider Modal */}
            <Modal isOpen={isAddProviderModalOpen} onClose={() => setIsAddProviderModalOpen(false)} title="Tambah Provider Baru">
                <form onSubmit={handleAddProviderSubmit} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nama Provider</label>
                        <input name="providerName" required className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL Logo (Opsional)</label>
                        <input name="providerLogoUrl" type="url" placeholder="https://example.com/logo.png" className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">ID Provider akan dibuat secara otomatis.</p>
                     <div className="pt-4 flex justify-end">
                        <button type="submit" className="px-6 py-2 bg-gold-500 text-navy-900 font-bold rounded-lg shadow-md hover:bg-gold-600 hover:shadow-soft-glow transition-all">Tambah</button>
                    </div>
                </form>
            </Modal>
            
            {/* Add Stock Modal */}
            <Modal isOpen={!!stockToAdd.voucher} onClose={() => setStockToAdd({ voucher: null, quantity: '' })} title={`Tambah Stok untuk ${stockToAdd.voucher?.name}`}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jumlah Stok Tambahan</label>
                        <input 
                            type="number"
                            value={stockToAdd.quantity}
                            onChange={(e) => setStockToAdd(prev => ({ ...prev, quantity: e.target.value }))}
                            autoFocus
                            className="w-full px-3 py-2 bg-gray-100 dark:bg-navy-800 border border-gray-300 dark:border-navy-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-gold-500" 
                        />
                        {stockToAdd.voucher && stockToAdd.voucher.plannedStock > 0 &&
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Sisa rencana tambah stok: {stockToAdd.voucher.plannedStock} pcs.</p>
                        }
                    </div>
                    <div className="pt-4 flex justify-end gap-4">
                        <button onClick={() => setStockToAdd({ voucher: null, quantity: '' })} className="px-6 py-2 text-gray-800 dark:text-white font-bold rounded-lg bg-gray-300 dark:bg-navy-700 hover:bg-gray-400 dark:hover:bg-navy-800 transition-all">Batal</button>
                        <button onClick={handleConfirmAddStock} className="px-6 py-2 bg-gold-500 text-navy-900 font-bold rounded-lg shadow-md hover:bg-gold-600 hover:shadow-soft-glow transition-all">Tambah</button>
                    </div>
                </div>
            </Modal>


            {/* Delete Confirmation Modals */}
            <Modal isOpen={!!deletingVoucher} onClose={() => setDeletingVoucher(null)} title="Konfirmasi Hapus">
                <p>Apakah Anda yakin ingin menghapus voucher <strong>{deletingVoucher?.name}</strong>? Data ini akan dihapus permanen.</p>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={() => setDeletingVoucher(null)} className="px-6 py-2 text-gray-800 dark:text-white font-bold rounded-lg bg-gray-300 dark:bg-navy-700 hover:bg-gray-400 dark:hover:bg-navy-800 transition-all">NO</button>
                    <button onClick={confirmDeleteVoucher} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 hover:shadow-soft-glow-red transition-all">YES</button>
                </div>
            </Modal>
            
             <Modal isOpen={!!deletingProvider} onClose={() => setDeletingProvider(null)} title="Konfirmasi Hapus">
                <p>Apakah Anda yakin ingin menghapus provider <strong>{deletingProvider?.name}</strong>? SEMUA VOUCHER di bawah provider ini akan dihapus permanen.</p>
                <div className="mt-6 flex justify-end gap-4">
                    <button onClick={() => setDeletingProvider(null)} className="px-6 py-2 text-gray-800 dark:text-white font-bold rounded-lg bg-gray-300 dark:bg-navy-700 hover:bg-gray-400 dark:hover:bg-navy-800 transition-all">NO</button>
                    <button onClick={confirmDeleteProvider} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 hover:shadow-soft-glow-red transition-all">YES</button>
                </div>
            </Modal>

            {/* Report Modal */}
            <Modal isOpen={isReportModalOpen} onClose={() => setIsReportModalOpen(false)} title={reportTitle}>
                <div className="max-h-96 overflow-y-auto bg-gray-100 dark:bg-navy-900 p-4 rounded-lg">
                    <pre className="text-xs whitespace-pre-wrap font-mono">{reportContent}</pre>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={copyReportToClipboard} className="flex items-center gap-2 px-6 py-2 bg-gold-500 text-navy-900 font-bold rounded-lg shadow-md hover:bg-gold-600 hover:shadow-soft-glow transition-all">
                        {/* Fix: Use imported Clipboard component */}
                        <Clipboard size={18} />
                        Copy to Clipboard
                    </button>
                </div>
            </Modal>
            
            {/* Print Choice Modal */}
            <Modal isOpen={isPrintChoiceModalOpen} onClose={() => setIsPrintChoiceModalOpen(false)} title="Pilih Jenis Resi">
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Pilih jenis laporan yang ingin Anda cetak sebagai resi thermal.</p>
                    <button 
                        onClick={() => handlePrintSelectedReceipt('complete')} 
                        className="w-full px-6 py-3 bg-gradient-to-r from-navy-700 to-navy-800 text-white font-bold rounded-lg shadow-lg hover:shadow-soft-glow transition-all duration-300 transform hover:scale-105"
                    >
                        Laporan Lengkap
                    </button>
                    <button 
                        onClick={() => handlePrintSelectedReceipt('short')} 
                        className="w-full px-6 py-3 bg-gradient-to-r from-gold-500 to-gold-600 text-navy-900 font-bold rounded-lg shadow-lg hover:shadow-soft-glow transition-all duration-300 transform hover:scale-105"
                    >
                        Laporan Singkat
                    </button>
                </div>
            </Modal>

            {/* Activity Log Modal */}
            <Modal isOpen={isActivityLogOpen} onClose={() => setIsActivityLogOpen(false)} title="Riwayat Aktivitas">
                <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
                    {activityLogs.length > 0 ? activityLogs.map(log => (
                        <div key={log.id} className="text-sm p-3 bg-gray-100 dark:bg-navy-800 rounded-lg">
                            <p className="font-semibold text-gray-800 dark:text-gray-200">{log.message}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                        </div>
                    )) : <p className="text-center text-gray-500 dark:text-gray-400">Belum ada aktivitas.</p>}
                </div>
            </Modal>

            {/* Toast Container */}
            <div aria-live="assertive" className="fixed inset-0 flex flex-col items-end px-4 py-6 pointer-events-none sm:p-6 sm:items-end z-50 space-y-4">
                {toasts.map(toast => (
                    <Toast key={toast.id} message={toast} onDismiss={dismissToast} />
                ))}
            </div>
            
             <style>{`
                @keyframes fade-in {
                  from { opacity: 0; }
                  to { opacity: 1; }
                }
                .animate-fade-in {
                  animation: fade-in 0.5s ease-in-out;
                }
             `}</style>
        </div>
    );
};

export default App;
