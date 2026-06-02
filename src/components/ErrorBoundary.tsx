import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    if (window.confirm("Вы уверены, что хотите полностью сбросить проект и начать заново? Это полностью очистит буфер localStorage и IndexedDB.")) {
      try {
        localStorage.removeItem('studio_writer_project');
        localStorage.removeItem('studio_writer_stage');
        
        // Try clearing IndexedDB
        const req = indexedDB.deleteDatabase('StudioWriterDB');
        req.onsuccess = () => {
          window.location.reload();
        };
        req.onerror = () => {
          window.location.reload();
        };
      } catch (e) {
        window.location.reload();
      }
    }
  };

  private handleExportRaw = () => {
    try {
      const stateStr = localStorage.getItem('studio_writer_project') || '';
      if (!stateStr) {
        alert("Нет сохраненных данных в localStorage.");
        return;
      }
      
      const blob = new Blob([stateStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `studio-writer-recovery-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Сбой при экспорте: " + String(err));
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-900 text-slate-100 p-6 font-sans">
          <div className="max-w-xl w-full bg-slate-950 border border-slate-800 p-8 rounded-lg shadow-2xl flex flex-col gap-6">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <div className="p-3 bg-rose-950/50 border border-rose-900 rounded text-rose-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-100">Ошибка инициализации / QuotaExceededError</h1>
                <p className="text-xs text-slate-400 mt-0.5">Внутренний сбой рендеринга React компонентов</p>
              </div>
            </div>

            <div className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 border border-slate-800 p-4 rounded max-h-48 overflow-y-auto font-mono text-[11px]">
              <p className="font-bold text-rose-400 mb-1">{this.state.error?.name}: {this.state.error?.message}</p>
              {this.state.error?.stack && (
                <pre className="whitespace-pre-wrap opacity-75">{this.state.error.stack}</pre>
              )}
            </div>

            <div className="text-xs leading-relaxed text-slate-400 border-l-2 border-amber-500 pl-3 py-1">
              <span className="font-semibold text-amber-400">Что произошло:</span> Возможно, объем сгенерированного сценария превысил квоту браузера 5MB для <code className="bg-slate-900 px-1 py-0.5 rounded text-amber-200">localStorage</code>. 
              Мы ввели авто-сжатие истории и резервную IndexedDB базу данных для обхода данных лимитов в новой версии, но предыдущая сессия могла быть нарушена.
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                id="recovery-btn-export"
                onClick={this.handleExportRaw}
                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-xs font-semibold tracking-wide border border-slate-700 hover:border-slate-600 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                💾 Экспортировать бэкап
              </button>
              <button
                id="recovery-btn-reset"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 rounded text-xs font-semibold tracking-wide border border-rose-900/40 hover:border-rose-900/60 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                🔄 Сбросить и начать заново
              </button>
              <button
                id="recovery-btn-reload"
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold tracking-wide transition-all cursor-pointer"
              >
                Обновить страницу
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
