// Lightweight toast notification system — zero dependencies
type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
    duration?: number;
}

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 99999;
    display: flex; flex-direction: column; gap: 10px;
    pointer-events: none; max-width: 420px; width: 100%;
  `;
    document.body.appendChild(container);
    return container;
}

function createToast(message: string, type: ToastType, opts: ToastOptions = {}) {
    const duration = opts.duration ?? (type === 'error' ? 5000 : 3000);
    const el = document.createElement('div');

    const icons: Record<ToastType, string> = {
        success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️',
    };

    const bgColors: Record<ToastType, string> = {
        success: 'linear-gradient(135deg, rgba(16,185,129,0.95), rgba(5,150,105,0.95))',
        error: 'linear-gradient(135deg, rgba(239,68,68,0.95), rgba(185,28,28,0.95))',
        info: 'linear-gradient(135deg, rgba(59,130,246,0.95), rgba(29,78,216,0.95))',
        warning: 'linear-gradient(135deg, rgba(245,158,11,0.95), rgba(217,119,6,0.95))',
    };

    el.style.cssText = `
    background: ${bgColors[type]};
    color: white; padding: 14px 20px; border-radius: 12px;
    font-family: 'Inter', system-ui, sans-serif; font-size: 14px; font-weight: 500;
    display: flex; align-items: center; gap: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1);
    backdrop-filter: blur(12px); pointer-events: auto; cursor: pointer;
    transform: translateX(120%); transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    max-width: 100%; word-break: break-word;
  `;

    el.innerHTML = `<span style="font-size:18px;flex-shrink:0">${icons[type]}</span><span style="flex:1">${message}</span>`;

    const dismiss = () => {
        el.style.transform = 'translateX(120%)';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 350);
    };

    el.onclick = dismiss;

    getContainer().appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.style.transform = 'translateX(0)';
        });
    });

    setTimeout(dismiss, duration);
}

const toast = {
    success: (msg: string, opts?: ToastOptions) => createToast(msg, 'success', opts),
    error: (msg: string, opts?: ToastOptions) => createToast(msg, 'error', opts),
    info: (msg: string, opts?: ToastOptions) => createToast(msg, 'info', opts),
    warning: (msg: string, opts?: ToastOptions) => createToast(msg, 'warning', opts),
};

export default toast;
