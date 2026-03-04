import React from 'react';
import Sidebar from './Sidebar';

export default function MainLayout({ children, userRole }) {
    return (
        <div className="flex min-h-screen overflow-hidden relative" style={{ backgroundColor: 'var(--bg-body)' }}>
            {/* Dynamic Background Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] blur-[120px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-1)' }} />
            <div className="absolute top-[20%] right-[-5%] w-[30%] h-[50%] blur-[100px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-2)' }} />
            <div className="absolute bottom-[-10%] left-[20%] w-[35%] h-[35%] blur-[120px] rounded-full pointer-events-none mix-blend-screen" style={{ background: 'var(--gradient-bg-1)', opacity: 0.3 }} />

            <Sidebar userRole={userRole} />

            {/* Main Content — ml-64 only on lg+, pt-14 for mobile topbar */}
            <main className="flex-1 lg:ml-64 min-h-screen h-screen overflow-y-auto w-full relative z-10 pt-14 lg:pt-0">
                <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:pt-10">
                    {children}
                </div>
            </main>
        </div>
    );
}
