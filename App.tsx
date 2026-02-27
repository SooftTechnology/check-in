import React, { useState, useEffect } from 'react';
import { MonthlyReview, SatisfactionLevel } from './types';
import { SATISFACTION_EMOJIS } from './constants';
import { Tooltip } from './components/Tooltip';
import { getDeveloperInsight } from './services/geminiService';
import { saveToGoogleSheets, checkIfResponseExists } from './services/googleSheetsService';

const App: React.FC = () => {
  const [userEmail, setUserEmail] = useState<string | null>(localStorage.getItem('devpulse_email'));
  const [emailInput, setEmailInput] = useState('');
  const [step, setStep] = useState(1);
  const [completion, setCompletion] = useState(0);
  const [bugs, setBugs] = useState(0);
  const [satisfaction, setSatisfaction] = useState<SatisfactionLevel | null>(null);
  const [selfEvaluation, setSelfEvaluation] = useState('');
  const [lowSatisfactionReason, setLowSatisfactionReason] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [allReviews, setAllReviews] = useState<MonthlyReview[]>([]);
  const [alreadyDoneThisMonth, setAlreadyDoneThisMonth] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);

  const currentMonthId = new Date().toISOString().slice(0, 7);
  const currentMonthName = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });

  useEffect(() => {
    const checkStatus = async () => {
      if (!userEmail) {
        setAlreadyDoneThisMonth(false);
        setIsCheckingStatus(false);
        return;
      }
      
      setIsCheckingStatus(true);
      console.log('🔍 Verificando estado para:', { email: userEmail, monthId: currentMonthId });
      
      // Cargar desde localStorage (caché local para UI rápida)
    const saved = localStorage.getItem('devpulse_reviews');
      let hasDoneLocal = false;
      
    if (saved) {
        try {
      const reviews: MonthlyReview[] = JSON.parse(saved);
      setAllReviews(reviews);
          hasDoneLocal = reviews.some(r => 
            r.developerEmail?.toLowerCase() === userEmail.toLowerCase() && 
            r.monthId === currentMonthId
          );
          console.log('📦 localStorage check:', hasDoneLocal ? '✅ Ya completado' : '❌ No completado');
        } catch (e) {
          console.error('❌ Error parsing localStorage:', e);
        }
      }
      
      // Verificar primero en Google Sheets (fuente de verdad para múltiples dispositivos)
      try {
        console.log('🌐 Verificando en Google Sheets...');
        const hasDoneInSheets = await checkIfResponseExists(userEmail, currentMonthId);
        console.log('🌐 Google Sheets check:', hasDoneInSheets ? '✅ Ya completado' : '❌ No completado');
        
        // Usar Google Sheets como fuente principal, localStorage como fallback
        setAlreadyDoneThisMonth(hasDoneInSheets || hasDoneLocal);
        
        // Si Google Sheets confirma que existe pero localStorage no, sincronizar
        if (hasDoneInSheets && !hasDoneLocal && saved) {
          console.log('📥 Sincronizando desde Google Sheets a localStorage...');
          // Agregar una entrada dummy a localStorage para sincronizar
          const reviews: MonthlyReview[] = JSON.parse(saved);
          const syncReview: MonthlyReview = {
            id: 'synced-from-sheets',
            developerEmail: userEmail,
            completionPercentage: 0,
            bugCount: 0,
            satisfaction: 1,
            timestamp: new Date().toLocaleString(),
            monthId: currentMonthId,
            monthName: currentMonthName,
          };
          const syncedReviews = [...reviews, syncReview];
          localStorage.setItem('devpulse_reviews', JSON.stringify(syncedReviews));
          setAllReviews(syncedReviews);
        }
      } catch (error) {
        // Si falla la verificación en Google Sheets, usar localStorage como fallback
        console.warn('⚠️ No se pudo verificar en Google Sheets, usando localStorage como fallback:', error);
        setAlreadyDoneThisMonth(hasDoneLocal);
      } finally {
        setIsCheckingStatus(false);
      }
    };
    
    checkStatus();
  }, [userEmail, currentMonthId]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailInput.includes('@')) {
      localStorage.setItem('devpulse_email', emailInput);
      setUserEmail(emailInput);
    }
  };

  const handleSubmit = async () => {
    if (!userEmail || satisfaction === null) return;

    setIsSubmitting(true);

    const combinedComments =
      selfEvaluation.trim() || lowSatisfactionReason.trim() || comments.trim()
        ? [
            selfEvaluation.trim() ? `Autoevaluación: ${selfEvaluation.trim()}` : '',
            satisfaction !== null && satisfaction <= 2 && lowSatisfactionReason.trim()
              ? `Motivo de baja satisfacción: ${lowSatisfactionReason.trim()}`
              : '',
            comments.trim() ? `Comentarios adicionales: ${comments.trim()}` : '',
          ]
          .filter(Boolean)
          .join('\n\n')
        : undefined;
    
    const newReview: MonthlyReview = {
      id: crypto.randomUUID(),
      developerEmail: userEmail,
      completionPercentage: completion,
      bugCount: bugs,
      satisfaction,
      comments: combinedComments,
      timestamp: new Date().toLocaleString(),
      monthId: currentMonthId,
      monthName: currentMonthName
    };

    const updatedReviews = [...allReviews, newReview];
    setAllReviews(updatedReviews);
    localStorage.setItem('devpulse_reviews', JSON.stringify(updatedReviews));

    // Guardar en Google Sheets
    await saveToGoogleSheets({
      email: userEmail,
      completion: completion,
      bugs: bugs,
      satisfaction: satisfaction,
      selfEvaluation: selfEvaluation.trim() || undefined,
      comments: combinedComments,
      timestamp: newReview.timestamp,
      monthId: currentMonthId,
      monthName: currentMonthName,
    });

    const feedback = await getDeveloperInsight(
      completion,
      bugs,
      satisfaction,
      combinedComments || ''
    );
    setInsight(feedback);
    
    setIsSubmitting(false);
    
    // Verificar inmediatamente después de guardar para asegurar que se actualice el estado
    try {
      const hasDoneInSheets = await checkIfResponseExists(userEmail, currentMonthId);
      const hasDoneLocal = updatedReviews.some(r => 
        r.developerEmail?.toLowerCase() === userEmail.toLowerCase() && 
        r.monthId === currentMonthId
      );
      setAlreadyDoneThisMonth(hasDoneInSheets || hasDoneLocal);
      console.log('✅ Estado actualizado después de guardar:', { hasDoneInSheets, hasDoneLocal });
    } catch (error) {
      // Si falla la verificación, usar el estado local
      setAlreadyDoneThisMonth(true);
      console.warn('⚠️ Error verificando después de guardar, usando estado local');
    }
    
    setStep(6); // Success step
  };

  const logout = () => {
    localStorage.removeItem('devpulse_email');
    setUserEmail(null);
    setAlreadyDoneThisMonth(false);
    setStep(1);
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-rocket text-3xl text-indigo-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Check-in mensual</h1>
          <p className="text-slate-500 mb-8 text-sm">Pulso simple del sprint y carga de horas.</p>
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                Email corporativo
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="ejemplo@sooft.ar"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="pt-2">
              <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-200">
                Comenzar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Mostrar spinner mientras se verifica el estado
  if (isCheckingStatus) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse">
            <i className="fa-solid fa-rocket text-3xl text-indigo-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Verificando estado...</h1>
          <p className="text-slate-500 text-sm">Comprobando si ya completaste este mes</p>
          <div className="mt-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  if (alreadyDoneThisMonth && step !== 6) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-calendar-check text-3xl text-green-600"></i>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">¡Misión Cumplida!</h1>
          <p className="text-slate-500 mb-6">Ya completaste tu check-in de <span className="font-bold text-indigo-600">{currentMonthName}</span>.</p>
          <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 mb-8">
            Gracias por mantener al equipo informado.
          </div>
          <button onClick={logout} className="text-slate-400 text-xs hover:text-red-500 transition-colors">
            Cerrar sesión ({userEmail})
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      <header className="max-w-xl w-full text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-2xl mb-4">
          <i className="fa-solid fa-rocket text-3xl text-indigo-600"></i>
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900">Sooft Check-in</h1>
        <p className="mt-2 text-slate-500">Reporte para <span className="font-medium text-slate-700">{userEmail}</span> • {currentMonthName}</p>
      </header>

      <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl p-8 relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-100 rounded-t-3xl overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${(Math.min(step, 5) / 5) * 100}%` }}
          />
        </div>

        {step === 1 && (
          <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <div>
              <div className="flex items-center mb-4">
                <h2 className="text-xl font-bold text-slate-800">1. Completitud del Sprint</h2>
                <Tooltip text="Considera el porcentaje de tareas finalizadas vs lo que habías estimado. ¿Se llegó al objetivo o hubo que patear algo?">
                  <i className="fa-solid fa-circle-info text-slate-400"></i>
                </Tooltip>
              </div>
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-600 text-4xl font-black">{completion}%</span>
                </div>
                <input
                  type="range" min="0" max="100" step="5"
                  value={completion}
                  onChange={(e) => setCompletion(parseInt(e.target.value))}
                  className="w-full h-3 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>
            <button onClick={() => setStep(2)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg">
              Continuar
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-6 text-center">2. Cantidad de Bugs / Errores</h2>
              <div className="flex items-center justify-center gap-8">
                <button onClick={() => setBugs(Math.max(0, bugs - 1))} className="w-14 h-14 rounded-full border-2 border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors">
                  <i className="fa-solid fa-minus text-slate-400"></i>
                </button>
                <span className="text-5xl font-black text-slate-800 w-16 text-center">{bugs}</span>
                <button onClick={() => setBugs(bugs + 1)} className="w-14 h-14 rounded-full border-2 border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-colors">
                  <i className="fa-solid fa-plus text-slate-400"></i>
                </button>
              </div>
              <p className="text-center text-sm text-slate-400 mt-4">Errores detectados en tu desarrollo este último sprint.</p>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="flex-1 text-slate-400 font-bold py-4">Atrás</button>
              <button onClick={() => setStep(3)} className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg">
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <div>
              <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">
                3. ¿Cómo evaluarías tu desempeño general en los últimos 30 días? ¿Por qué?
              </h2>
              <p className="text-sm text-slate-500 mb-4 text-center">
                ¿Has enfrentado alguna dificultad o problema que haya afectado tu trabajo?
              </p>
              <textarea
                value={selfEvaluation}
                onChange={(e) => setSelfEvaluation(e.target.value)}
                placeholder="Comparte tu autoevaluación..."
                className="w-full h-32 px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors resize-none text-slate-700"
              />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(2)} className="flex-1 text-slate-400 font-bold py-4">
                Atrás
              </button>
              <div
                className="flex-[2]"
                title={
                  selfEvaluation.trim().length < 3
                    ? 'Por favor redactá aunque sea un poco más tu respuesta.'
                    : undefined
                }
              >
                <button
                  onClick={() => {
                    if (selfEvaluation.trim().length >= 3) {
                      setStep(4);
                    }
                  }}
                  disabled={selfEvaluation.trim().length < 3}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50"
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-8 animate-in slide-in-from-right duration-500 text-center">
            <h2 className="text-xl font-bold text-slate-800">4. Satisfacción con el trabajo</h2>
            <div className="grid grid-cols-5 gap-2">
              {SATISFACTION_EMOJIS.map((item) => (
                <button
                  key={item.level}
                  onClick={() => setSatisfaction(item.level)}
                  className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all ${
                    satisfaction === item.level ? 'border-indigo-500 bg-indigo-50 scale-105' : 'border-transparent hover:bg-slate-50'
                  }`}
                >
                  <span className="text-4xl mb-2">{item.emoji}</span>
                  <span className={`text-[8px] font-bold ${item.color}`}>{item.label.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-4 pt-4">
              <button onClick={() => setStep(3)} className="flex-1 text-slate-400 font-bold py-4">
                Atrás
              </button>
              <button
                onClick={() => setStep(5)}
                disabled={satisfaction === null}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          satisfaction !== null &&
          (satisfaction <= 2 ? (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">
                  5. Contanos un poco más
                </h2>
                <p className="text-sm text-slate-500 mb-4 text-center">
                  ¿Qué hizo que tu satisfacción sea baja este mes? Cualquier detalle nos ayuda a
                  entender mejor cómo acompañarte.
                </p>
                <textarea
                  value={lowSatisfactionReason}
                  onChange={(e) => setLowSatisfactionReason(e.target.value)}
                  placeholder="Podés compartir qué pasó o qué se puede mejorar..."
                  className="w-full h-32 px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors resize-none text-slate-700"
                />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(4)} className="flex-1 text-slate-400 font-bold py-4">
                  Atrás
                </button>
                <div
                  className="flex-[2]"
                  title={
                    lowSatisfactionReason.trim().length < 3
                      ? 'Por favor redactá aunque sea un poco más tu respuesta.'
                      : undefined
                  }
                >
                  <button
                    onClick={() => {
                      if (lowSatisfactionReason.trim().length >= 3 && !isSubmitting) {
                        handleSubmit();
                      }
                    }}
                    disabled={isSubmitting || lowSatisfactionReason.trim().length < 3}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isSubmitting ? (
                      <i className="fa-solid fa-spinner animate-spin"></i>
                    ) : (
                      'Finalizar Check-in'
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-right duration-500">
              <div>
                <h2 className="text-xl font-bold text-slate-800 mb-4 text-center">
                  5. ¿Algún comentario adicional?
                </h2>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="En este espacio podes comentar o preguntar al equipo de Sooft"
                  className="w-full h-32 px-4 py-3 border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors resize-none text-slate-700"
                />
              </div>
              <div className="flex gap-4">
                <button onClick={() => setStep(4)} className="flex-1 text-slate-400 font-bold py-4">
                  Atrás
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {isSubmitting ? (
                    <i className="fa-solid fa-spinner animate-spin"></i>
                  ) : (
                    'Finalizar Check-in'
                  )}
                </button>
              </div>
            </div>
          ))
        )}

        {step === 6 && (
          <div className="text-center space-y-6 animate-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-check text-4xl text-green-600"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-800">¡Recibido!</h2>
            <p className="text-slate-500">Tu reporte mensual ha sido guardado exitosamente.</p>
            {insight && (
              <div className="bg-indigo-50 p-6 rounded-2xl text-left relative mt-4 border-l-4 border-indigo-400">
                <i className="fa-solid fa-quote-left absolute top-4 left-4 text-indigo-200 text-xl"></i>
                <p className="text-indigo-900 text-sm leading-relaxed italic ml-6">{insight}</p>
              </div>
            )}
            <p className="text-xs text-slate-400 pt-4">Puedes cerrar esta pestaña de forma segura.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
