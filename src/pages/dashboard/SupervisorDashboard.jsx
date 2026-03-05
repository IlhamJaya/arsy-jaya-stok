import React from 'react';
import {
    Package,
    AlertTriangle,
    Clock,
    TrendingUp,
    TrendingDown,
    ArrowRight,
    CheckCircle2,
    XCircle,
    FileText
} from 'lucide-react';

export default function SupervisorDashboard() {
    const kpis = [
        {
            title: "Active Stock Items",
            value: "1,248",
            trend: "+12.5%",
            trendUp: true,
            icon: Package,
            color: "text-accent-base",
            bg: "bg-accent-base/10"
        },
        {
            title: "Pending Reports",
            value: "14",
            trend: "Requires Review",
            trendUp: false,
            icon: Clock,
            color: "text-brand-amber",
            bg: "bg-brand-amber/10"
        },
        {
            title: "Critical Alerts",
            value: "3",
            trend: "Low Stock",
            trendUp: false,
            icon: AlertTriangle,
            color: "text-brand-red",
            bg: "bg-brand-red/10"
        }
    ];

    return (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <header className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-white mb-2">Dashboard Overview</h2>
                    <p className="text-slate-400">Welcome back, Supervisor. Here's what's happening today.</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 hover:bg-slate-700/80 text-white rounded-xl border border-white/10 backdrop-blur shadow-sm transition-all focus:ring-2 focus:ring-accent-base/20">
                        <FileText className="w-4 h-4" />
                        <span className="font-medium text-sm">Download Report</span>
                    </button>
                </div>
            </header>

            {/* BENTO GRID LAYOUT */}
            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6 auto-rows-[minmax(180px,auto)]">

                {/* ROW 1: KPI Cards */}
                {kpis.map((kpi, idx) => (
                    <div key={idx} className="glass-card p-6 flex flex-col justify-between group hover:border-white/10 transition-colors">
                        <div className="flex justify-between items-start">
                            <div className={`p-3 rounded-xl border border-white/5 ${kpi.bg}`}>
                                <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/50 border border-white/5">
                                {kpi.trendUp ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-accent-base" />
                                ) : (
                                    <TrendingDown className={`w-3.5 h-3.5 ${kpi.color}`} />
                                )}
                                <span className={`text-[11px] font-mono font-medium ${kpi.trendUp ? 'text-accent-base' : kpi.color}`}>
                                    {kpi.trend}
                                </span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-sm font-medium text-slate-400 mb-1">{kpi.title}</h3>
                            <p className="text-3xl font-bold text-white font-mono tracking-tight">{kpi.value}</p>
                        </div>
                    </div>
                ))}

                {/* Feature: Quick Actions (Spans 1 col, 2 rows) */}
                <div className="glass-card p-6 xl:row-span-2 flex flex-col hidden xl:flex">
                    <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                        <span className="w-1 h-4 rounded-full bg-accent-base inline-block"></span>
                        Quick Actions
                    </h3>
                    <div className="flex flex-col gap-3 flex-1">
                        <button className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-white/5 hover:bg-accent-base/10 hover:border-accent-base/20 transition-all text-left group">
                            <div>
                                <strong className="block text-sm font-medium text-slate-200 group-hover:text-accent-base">Add New Item</strong>
                                <span className="text-xs text-slate-400 mt-0.5 block">Record new stock to inventory</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-accent-base" />
                        </button>
                        <button className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-white/5 hover:bg-brand-amber/10 hover:border-brand-amber/20 transition-all text-left group">
                            <div>
                                <strong className="block text-sm font-medium text-slate-200 group-hover:text-brand-amber">Review Reports</strong>
                                <span className="text-xs text-slate-400 mt-0.5 block">14 pending items</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-amber" />
                        </button>
                        <button className="flex items-center justify-between p-4 rounded-xl bg-slate-800/40 border border-white/5 hover:bg-brand-red/10 hover:border-brand-red/20 transition-all text-left group mt-auto">
                            <div>
                                <strong className="block text-sm font-medium text-slate-200 group-hover:text-brand-red">Contact Supplier</strong>
                                <span className="text-xs text-slate-400 mt-0.5 block">Send WA templates</span>
                            </div>
                            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-brand-red" />
                        </button>
                    </div>
                </div>

                {/* ROW 2: Pending Reports List (Spans 3 cols) */}
                <div className="glass-card md:col-span-3 overflow-hidden flex flex-col relative">
                    <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/40 backdrop-blur-sm z-10">
                        <h3 className="text-base font-semibold text-white flex items-center gap-2">
                            <span className="w-1 h-4 rounded-full bg-brand-amber inline-block"></span>
                            Pending Moderation
                        </h3>
                        <button className="text-xs font-medium text-accent-base hover:underline flex items-center gap-1">
                            View All <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-x-auto relative">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                            <thead>
                                <tr className="text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-800/30">
                                    <th className="px-6 py-4 pb-3">Item details</th>
                                    <th className="px-6 py-4 pb-3">Operator</th>
                                    <th className="px-6 py-4 pb-3">Type</th>
                                    <th className="px-6 py-4 pb-3 text-right">Quantity</th>
                                    <th className="px-6 py-4 pb-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {[
                                    { item: 'Stiker Chromo A3+', id: '#ITM-0089', op: 'Budi (Cetak)', type: 'Usage', qty: '500 lbr' },
                                    { item: 'Kertas Art Carton 260g', id: '#ITM-0042', op: 'Agus (Cutting)', type: 'Damage', qty: '12 lbr' },
                                    { item: 'Tinta Magenta Eco', id: '#ITM-0112', op: 'Budi (Cetak)', type: 'Usage', qty: '2 btl' },
                                ].map((row, i) => (
                                    <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-slate-800 border border-white/5 flex items-center justify-center">
                                                    <Package className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-slate-200">{row.item}</p>
                                                    <p className="text-xs font-mono text-slate-500 mt-0.5">{row.id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-300">{row.op}</td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2 py-1 rounded border text-[11px] font-medium tracking-wide w-fit
                        ${row.type === 'Usage' ? 'bg-accent-base/10 text-accent-base border-accent-base/20' : 'bg-brand-red/10 text-brand-red border-brand-red/20'}`}>
                                                {row.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-mono text-right text-slate-200">{row.qty}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-1.5 rounded-lg text-accent-base hover:bg-accent-base/20 transition-colors" title="Approve">
                                                    <CheckCircle2 className="w-5 h-5" />
                                                </button>
                                                <button className="p-1.5 rounded-lg text-brand-red hover:bg-brand-red/20 transition-colors" title="Reject">
                                                    <XCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
