// src/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AdminUser, AuthState } from '@/types';

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      expiresAt: null,
      isAuthenticated: false,
      setAuth: ({ token, expiresAt, user }) =>
        set({ token, expiresAt, user, isAuthenticated: true }),
      clearAuth: () =>
        set({ token: null, expiresAt: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'outpro-auth',
      storage: createJSONStorage(() => sessionStorage), // Not localStorage — clears on tab close
      partialize: (state) => ({
        token: state.token,
        expiresAt: state.expiresAt,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);


// src/store/toastStore.ts
import { nanoid } from 'nanoid';
import type { Toast, ToastType } from '@/types';

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// Inline nanoid fallback
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    const duration = toast.duration ?? 4000;
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  success: (title, message) =>
    useToastStore.getState().addToast({ type: 'success', title, message }),
  error: (title, message) =>
    useToastStore.getState().addToast({ type: 'error', title, message, duration: 6000 }),
  warning: (title, message) =>
    useToastStore.getState().addToast({ type: 'warning', title, message }),
  info: (title, message) =>
    useToastStore.getState().addToast({ type: 'info', title, message }),
}));


// src/store/uiStore.ts
interface UiState {
  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;
  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  mobileMenuOpen: false,
  toggleMobileMenu: () =>
    set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  closeMobileMenu: () => set({ mobileMenuOpen: false }),
  activeModal: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
