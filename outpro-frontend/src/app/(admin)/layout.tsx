// src/app/(admin)/layout.tsx
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminTopBar } from '@/components/admin/AdminTopBar';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // Read role injected by middleware
  const headersList = headers();
  const role = headersList.get('x-user-role');
  if (!role) redirect('/login');

  return (
    <div className="flex h-screen bg-neutral-50 overflow-hidden">
      <AdminSidebar role={role as 'super_admin' | 'editor' | 'viewer'} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminTopBar />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
