import React, { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseAdmin } from '../../supabaseClient';
import { 
    Users, UserPlus, Shield, User, Scissors, Paintbrush, Edit3,
    Settings, CheckCircle2, AlertTriangle, AlertCircle, Trash2
 } from 'lucide-react';
import { capitalizeWords, handleNumberInput } from '../../utils/formatters.js';
import useAppStore from '../../store/useAppStore';

export default function ProfilesDashboard() {
    const [profiles, setProfiles] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const theme = useAppStore((s) => s.theme);

    // Modals state
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

    const [selectedUser, setSelectedUser] = useState(null);
    const [confirmDeleteUser, setConfirmDeleteUser] = useState(null); // { userId, userEmail } | null

    // Forms State
    const [newUserForm, setNewUserForm] = useState({
        email: '',
        password: '',
        fullName: '',
        role: 'OP_CETAK'
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchProfiles = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const client = supabaseAdmin || supabase;
            const { data, error } = await client
                .from('profiles')
                .select('*')
                .order('role', { ascending: true })
                .order('full_name', { ascending: true });

            if (error) throw error;

            let profilesData = data || [];

            // Email disimpan di Supabase Auth (auth.users), bukan di tabel `profiles`
            // sehingga perlu ditarik via admin client, lalu di-merge ke object profiles.
            if (supabaseAdmin && profilesData.length > 0) {
                const emailByUserId = {};
                const perPage = 100;
                let page = 1;

                // pagination safety: biasanya jumlah user tidak besar
                while (page < 50) {
                    const { data: usersResp, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
                        page,
                        perPage,
                    });

                    if (usersError) throw usersError;

                    const users = usersResp?.users || [];
                    users.forEach((u) => {
                        if (u?.id) emailByUserId[u.id] = u.email || null;
                    });

                    if (users.length < perPage) break;
                    page += 1;
                }

                profilesData = profilesData.map((p) => ({
                    ...p,
                    email: emailByUserId[p.id] ?? p.email ?? null,
                }));
            }

            setProfiles(profilesData);
        } catch (err) {
            console.error("Error fetching profiles:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    // Handle Add User
    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!supabaseAdmin) {
            setError("Supabase Admin Key tiak ditemukan di environment. Fitur ini dinonaktifkan.");
            return;
        }

        setIsSubmitting(true);
        setError(null);
        try {
            // 1. Create User in Auth
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: newUserForm.email,
                password: newUserForm.password,
                email_confirm: true,
                user_metadata: {
                    full_name: newUserForm.fullName
                }
            });

            if (authError) throw authError;

            // 2. The database trigger (handle_new_user) will automatically create the profile row.
            // However, we need to UPDATE the profile row with the correct role.
            const userId = authData.user.id;

            const { error: updateError } = await supabaseAdmin
                .from('profiles')
                .update({ role: newUserForm.role })
                .eq('id', userId);

            if (updateError) throw updateError;

            // Success
            setIsAddUserModalOpen(false);
            setNewUserForm({ email: '', password: '', fullName: '', role: 'OP_CETAK' });
            fetchProfiles();

        } catch (err) {
            console.error("Error adding user:", err);
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle Edit Profile
    const handleEditProfile = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        try {
            const client = supabaseAdmin || supabase;
            const { error } = await client
                .from('profiles')
                .update({ role: selectedUser.role, full_name: selectedUser.full_name })
                .eq('id', selectedUser.id);

            if (error) throw error;

            setIsEditProfileModalOpen(false);
            setSelectedUser(null);
            fetchProfiles();

        } catch (err) {
            console.error("Error updating profile:", err);
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Request Delete User (open modal confirm)
    const handleRequestDeleteUser = async (userId, userEmail) => {
        if (!supabaseAdmin) {
            setError("Supabase Admin Key tiak ditemukan di environment. Fitur hapus dinonaktifkan.");
            return;
        }

        setConfirmDeleteUser({ userId, userEmail });
    };

    // Perform Delete User (only when confirmed)
    const performDeleteUser = async (userId, userEmail) => {
        setConfirmDeleteUser(null);
        setIsLoading(true);
        setError(null);
        try {
            // Delete from Auth (this usually cascades to profiles, but let's be safe or just delete auth)
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
            if (authError) throw authError;

            // Also delete from profiles if it doesn't cascade
            await supabaseAdmin.from('profiles').delete().eq('id', userId);

            fetchProfiles();
        } catch (err) {
            console.error("Error deleting user:", err);
            setError(err.message);
            setIsLoading(false); // only disable loading on error, on success fetchProfiles handles it
        }
    };


    const getRoleIcon = (role) => {
        const r = (role || '').toString().trim().toUpperCase();
        switch (r) {
            case 'SPV': return <Shield className="w-5 h-5" />;
            case 'SALES': return <User className="w-5 h-5" />;
            case 'OP_CUTTING': return <Scissors className="w-5 h-5" />;
            case 'OP_CETAK': return <Paintbrush className="w-5 h-5" />;
            default: return <User className="w-5 h-5" />;
        }
    };

    const getRoleColorClass = (role) => {
        const r = (role || '').toString().trim().toUpperCase();
        switch (r) {
            case 'SPV': return 'text-brand-amber bg-brand-amber/10 border-brand-amber/20';
            case 'SALES': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
            case 'OP_CUTTING': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
            // Pakai warna Tailwind yang lebih kontras di light mode.
            case 'OP_CETAK': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30';
            default: return 't-secondary bg-slate-400/10 border-slate-400/20';
        }
    };

    const getRoleLabel = (role) => {
        const r = (role || '').toString().trim().toUpperCase();
        switch (r) {
            case 'SPV': return 'SPV';
            case 'SALES': return 'SALES';
            case 'OP_CUTTING': return 'OP_CUTTING (Cutting)';
            case 'OP_CETAK': return 'OP_CETAK (Cetak)';
            default: return role || 'GUEST';
        }
    };

    const getRoleBadgeStyle = (role) => {
        const r = (role || '').toString().trim().toUpperCase();
        if (r === 'OP_CETAK') {
            // Inline style agar warna tidak "ketimpa" / tidak kebaca di light mode.
            return {
                color: '#059669', // emerald-600
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.65)',
            };
        }
        return undefined;
    };

    return (
        <div className="w-full animate-in fade-in py-2">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight t-primary mb-2 flex items-center gap-3">
                        <Users className="w-8 h-8 text-blue-400" />
                        Manajemen Pengguna
                    </h2>
                    <p className="t-secondary">Atur profil, level akses (role), dan pengaturan akun.</p>
                </div>

                <button
                    onClick={() => setIsAddUserModalOpen(true)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 t-primary font-medium rounded-xl transition-all shadow-lg shadow-blue-500/20 ring-1 ring-blue-500/50 hover:ring-blue-400"
                >
                    <UserPlus className="w-5 h-5" />
                    Tambah Pengguna Baru
                </button>
            </div>

            {error && !isAddUserModalOpen && !isEditProfileModalOpen && (
                <div className="mb-8 p-4 bg-brand-red/10 border border-brand-red/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-brand-red shrink-0 mt-0.5" />
                    <p className="text-sm text-brand-red/90">{error}</p>
                </div>
            )}

            {/* Profiles List (mendatar) */}
            {isLoading ? (
                <div className="glass-card min-h-[400px] flex items-center justify-center">
                    <div className="w-10 h-10 border-t-2 border-r-2 border-blue-500 rounded-full animate-spin"></div>
                </div>
            ) : profiles.length === 0 ? (
                <div className="glass-card min-h-[400px] flex flex-col items-center justify-center t-muted">
                    <Users className="w-12 h-12 mb-4 opacity-50" />
                    <p>Belum ada data pengguna.</p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr
                                    className="text-xs font-semibold t-muted uppercase tracking-wider"
                                    style={{ background: 'var(--bg-input)', borderBottom: '1px solid var(--border-glass)' }}
                                >
                                    <th className="px-6 py-4">UID</th>
                                    <th className="px-6 py-4">Display name</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4">Email</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {profiles.map((profile) => (
                                    <tr
                                        key={profile.id}
                                        className="border-t border-theme hover:bg-surface/60 transition-colors"
                                    >
                                        <td className="px-6 py-4 font-mono text-xs t-muted" title={profile.id}>
                                            {profile.id ? profile.id.substring(0, 8) : '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="font-semibold t-primary truncate">
                                                {profile.full_name || profile.email || 'User'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span
                                                className={`inline-flex items-center gap-2 text-xs font-mono px-2 py-0.5 rounded border ${getRoleColorClass(profile.role)}`}
                                                style={getRoleBadgeStyle(profile.role)}
                                            >
                                                {getRoleIcon(profile.role)}
                                                <span>{getRoleLabel(profile.role)}</span>
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 break-all">
                                            <span className="text-sm t-secondary font-mono">{profile.email || '-'}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="inline-flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedUser({ ...profile });
                                                        setIsEditProfileModalOpen(true);
                                                        setError(null);
                                                    }}
                                                    className="p-2 t-secondary hover:text-white bg-input hover:bg-slate-700/80 rounded-lg transition-colors tooltip-trigger"
                                                    title="Edit Profil"
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRequestDeleteUser(profile.id, profile.email || profile.full_name)}
                                                    className="p-2 t-secondary hover:text-brand-red bg-input hover:bg-brand-red/20 rounded-lg transition-colors tooltip-trigger"
                                                    title="Hapus Pengguna"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}


            {/* Add User Modal */}
            {isAddUserModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && setIsAddUserModalOpen(false)}></div>

                    <div className="glass-card w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200 border-blue-500/20">
                        <h3 className="text-xl font-bold t-primary mb-2 flex items-center gap-2">
                            <UserPlus className="w-5 h-5 text-blue-400" />
                            Tambah User Baru
                        </h3>
                        <p className="text-sm t-secondary mb-6">Buat akun untuk memberi akses ke dalam sistem Arsy Stok Pro.</p>

                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserForm.fullName}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                    placeholder="Contoh: Budi Santoso"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Email User</label>
                                <input
                                    type="email"
                                    required
                                    value={newUserForm.email}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                    placeholder="email@arsy.co.id"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Password Sementara</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newUserForm.password}
                                    onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                    placeholder="Minimal 6 Karakter"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Posisi / Akses Sistem</label>
                                <div className="relative">
                                    <select
                                        value={newUserForm.role}
                                        onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                                        className="w-full appearance-none bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                    >
                                        <option value="OP_CETAK">Operator - Mesin Cetak A3+</option>
                                        <option value="OP_CUTTING">Operator - Mesin Cutting/Finishing</option>
                                        <option value="SALES">Staf Admin / Frontoffice</option>
                                        <option value="HRD">HRD / Manajemen Personalia</option>
                                        <option value="SPV">Supervisor Cabang</option>
                                    </select>
                                </div>
                            </div>

                            {!supabaseAdmin && (
                                <div className="p-3 bg-brand-amber/10 border border-brand-amber/20 rounded-lg flex items-start gap-2 mt-2">
                                    <AlertTriangle className="w-4 h-4 text-brand-amber shrink-0 mt-0.5" />
                                    <p className="text-xs text-brand-amber/90">Tombol dinonaktifkan. Anda harus memasukkan `VITE_SUPABASE_SERVICE_ROLE_KEY` di file `.env`.</p>
                                </div>
                            )}

                            {error && (
                                <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg flex items-start gap-2 mt-2">
                                    <AlertCircle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
                                    <p className="text-xs text-brand-red/90">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-theme">
                                <button
                                    type="button"
                                    onClick={() => setIsAddUserModalOpen(false)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-sm font-medium t-secondary hover:text-white transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting || !supabaseAdmin}
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 t-primary font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20"
                                >
                                    {isSubmitting ? (
                                        <><div className="w-4 h-4 rounded-full border-t-2 border-r-2 border-white animate-spin"></div> Mendaftarkan...</>
                                    ) : (
                                        <><UserPlus className="w-4 h-4" /> Daftarkan Akses</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}


            {/* Edit Profile Modal */}
            {isEditProfileModalOpen && selectedUser && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => !isSubmitting && setIsEditProfileModalOpen(false)}></div>

                    <div className="glass-card w-full max-w-md p-6 relative z-10 animate-in zoom-in-95 duration-200">
                        <h3 className="text-xl font-bold t-primary mb-2 flex items-center gap-2">
                            <Edit3 className="w-5 h-5 t-secondary" />
                            Ubah Profil Pengguna
                        </h3>
                        <p className="text-sm t-secondary mb-6">Ubah nama dan hak akses pengguna ini.</p>

                        <form onSubmit={handleEditProfile} className="space-y-4">

                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Nama Lengkap</label>
                                <input
                                    type="text"
                                    required
                                    value={selectedUser.full_name || ''}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, full_name: e.target.value })}
                                    className="w-full bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold t-secondary uppercase tracking-wider mb-2">Pilih Role Baru</label>
                                <div className="relative">
                                    <select
                                        value={selectedUser.role}
                                        onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                                        className="w-full appearance-none bg-input border border-theme t-primary text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all font-mono"
                                    >
                                        <option value="OP_CETAK">OP_CETAK (Operator Mesin Cetak)</option>
                                        <option value="OP_CUTTING">OP_CUTTING (Operator Mesin Potong)</option>
                                        <option value="SALES">SALES (Staf Admin / Penerima Order)</option>
                                        <option value="HRD">HRD (Human Resource Dept.)</option>
                                        <option value="SPV">SPV (Supervisor Akses Penuh)</option>
                                    </select>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-brand-red/10 border border-brand-red/20 rounded-lg flex items-start gap-2 mt-2">
                                    <AlertCircle className="w-4 h-4 text-brand-red shrink-0 mt-0.5" />
                                    <p className="text-xs text-brand-red/90">{error}</p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 mt-4 border-t border-theme">
                                <button
                                    type="button"
                                    onClick={() => setIsEditProfileModalOpen(false)}
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-sm font-medium t-secondary hover:text-white transition-colors"
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="flex items-center gap-2 px-6 py-2 bg-input hover:bg-slate-700 t-primary border border-theme font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <><div className="w-4 h-4 rounded-full border-t-2 border-r-2 border-white animate-spin"></div> Menyimpan...</>
                                    ) : (
                                        <>Simpan Perubahan</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirm Delete User Modal */}
            {confirmDeleteUser && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <div
                        className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                        onClick={() => !isLoading && setConfirmDeleteUser(null)}
                    />
                    <div
                        className="glass-card w-full max-w-lg p-6 relative z-10 animate-in zoom-in-95 duration-200"
                        style={{
                            border: '1px solid var(--border-glass)',
                            backgroundColor: theme === 'light' ? '#ffffff' : undefined,
                        }}
                    >
                        <h3 className="text-xl font-bold t-primary mb-2 flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-brand-red" />
                            Konfirmasi Hapus Pengguna
                        </h3>
                        <p className="t-secondary text-sm mb-6">
                            Apakah Anda yakin ingin menghapus permanen pengguna{' '}
                            <span className="t-primary font-semibold">
                                {confirmDeleteUser.userEmail || '-'}
                            </span>
                            ?
                        </p>
                        <div className="flex gap-3 justify-end pt-4" style={{ borderTop: '1px solid var(--border-glass)' }}>
                            <button
                                type="button"
                                onClick={() => setConfirmDeleteUser(null)}
                                className="px-4 py-2 text-sm font-medium rounded-xl t-secondary hover:bg-white/5 transition-colors"
                                disabled={isLoading}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    performDeleteUser(confirmDeleteUser.userId, confirmDeleteUser.userEmail)
                                }
                                className="px-5 py-2 text-sm font-bold text-white bg-brand-red rounded-xl hover:bg-brand-red/90 transition-colors shadow-lg shadow-brand-red/20 flex items-center justify-center min-w-[160px]"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-t-2 border-r-2 border-white rounded-full animate-spin" />
                                ) : (
                                    'Hapus Pengguna'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
