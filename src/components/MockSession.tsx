import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, AlertCircle, Clock, Loader2, CheckCircle2 } from 'lucide-react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { getQuestionBank, submitAnswer, completeSession } from '../api/interviews';
import client from '../api/client';

interface Question {
  id: string; category: string; question: string; purpose: string;
  difficulty: string; expected_framework: string;
}

export default function MockSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const bankId = searchParams.get('bankId');
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answerText, setAnswerText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState('');
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [submitting, setSubmitting] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const timerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!bankId) return;
    getQuestionBank(bankId)
      .then(data => setQuestions(data.questions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bankId]);

  useEffect(() => {
    timerRef.current = setInterval(() => setTimeLeft(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(timerRef.current);
  }, []);

  // Clean up MediaRecorder on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Speech-to-text ──────────────────────────────────────────────────────────

  const startRecording = async () => {
    setTranscribeError('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick the best supported MIME type (webm for Chrome/Firefox, mp4 for Safari)
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all mic tracks so the browser mic indicator disappears
        stream.getTracks().forEach(t => t.stop());

        const audioBlob = new Blob(audioChunksRef.current, {
          type: mimeType || 'audio/webm',
        });
        await sendToTranscribe(audioBlob, mimeType || 'audio/webm');
      };

      recorder.start();
      setIsRecording(true);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone access denied. Please allow mic access in your browser.'
        : 'Could not start recording. Please check your microphone.';
      setTranscribeError(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsTranscribing(true);
  };

  const sendToTranscribe = async (audioBlob: Blob, mimeType: string) => {
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const formData = new FormData();
      formData.append('file', audioBlob, `recording.${ext}`);

      const res = await client.post('/api/transcribe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const transcribed: string = res.data?.text || '';
      if (transcribed) {
        // Append to existing answer with a space separator
        setAnswerText(prev => prev ? `${prev} ${transcribed}` : transcribed);
      } else {
        setTranscribeError('No speech detected. Please try again.');
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '';
      if (detail.includes('loading')) {
        setTranscribeError('Whisper model is warming up — please wait 20s and try again.');
      } else {
        setTranscribeError('Transcription failed. Please try again or type your answer.');
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicClick = () => {
    if (isTranscribing) return; // ignore clicks while waiting for API
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── Submit / Navigation ─────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!sessionId || !answerText.trim() || submitting) return;
    setSubmitting(true);
    setLastFeedback(null);
    try {
      const currentQ = questions[currentIdx];
      const result = await submitAnswer(sessionId, currentQ.id, answerText);
      setLastFeedback(result);
      setAnswerText('');
    } catch {} finally { setSubmitting(false); }
  };

  const handleNext = () => {
    setLastFeedback(null);
    setTranscribeError('');
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(idx => idx + 1);
    }
  };

  const handleComplete = async () => {
    if (!sessionId || completing) return;
    setCompleting(true);
    try {
      await completeSession(sessionId);
      navigate(`/interview/feedback/${sessionId}`);
    } catch {} finally { setCompleting(false); }
  };

  const isLast = currentIdx === questions.length - 1;
  const currentQ = questions[currentIdx];

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  // Mic button appearance
  const micBusy = isRecording || isTranscribing;
  const micLabel = isTranscribing ? 'Transcribing…' : isRecording ? 'Stop' : 'Speak';
  const micIcon = isTranscribing
    ? <Loader2 className="w-5 h-5 animate-spin" />
    : isRecording
    ? <MicOff className="w-5 h-5" />
    : <Mic className="w-5 h-5" />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
        <button onClick={handleComplete} className="text-gray-500 hover:text-gray-900 transition-colors font-medium text-sm">
          Exit Session
        </button>
        <div className="flex items-center gap-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border font-mono font-bold ${
            timeLeft < 120 ? 'text-red-600 bg-red-50 border-red-200' : 'text-amber-600 bg-amber-50 border-amber-200'
          }`}>
            <Clock className="w-4 h-4" /> {formatTime(timeLeft)}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-bold uppercase tracking-widest text-gray-500">
              Question {currentIdx + 1} of {questions.length}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-8 gap-6">
        {/* Progress */}
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${((currentIdx + 1) / Math.max(questions.length, 1)) * 100}%` }} />
        </div>

        {/* Question */}
        {currentQ && (
          <div className="p-10 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col gap-4">
            <div className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {currentQ.category?.replace('_', ' ')}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">"{currentQ.question}"</h2>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 bg-gray-100 text-gray-600 rounded-md">
                Framework: {currentQ.expected_framework || 'STAR'}
              </span>
              <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-md border ${
                currentQ.difficulty === 'hard' ? 'bg-red-50 text-red-600 border-red-200' :
                currentQ.difficulty === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                {currentQ.difficulty}
              </span>
            </div>
          </div>
        )}

        {/* Feedback from last submission */}
        {lastFeedback && (
          <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="flex items-center gap-2 mb-3 font-bold text-emerald-700">
              <CheckCircle2 className="w-5 h-5" /> Answer submitted! Here's your quick feedback:
            </div>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {(['relevance', 'clarity', 'depth', 'confidence', 'structure'] as const).map(dim => {
                const score = lastFeedback[`${dim}_score`] as number;
                return (
                  <div key={dim} className="text-center">
                    <div className={`text-xl font-bold ${score >= 8 ? 'text-emerald-600' : score >= 6 ? 'text-amber-600' : 'text-red-500'}`}>
                      {score?.toFixed(1)}
                    </div>
                    <div className="text-xs capitalize text-gray-400 font-medium mt-0.5">{dim}</div>
                  </div>
                );
              })}
            </div>
            {lastFeedback.feedback?.strength && (
              <p className="text-sm text-gray-700"><span className="font-bold text-emerald-700">✓ Strength:</span> {lastFeedback.feedback.strength}</p>
            )}
          </div>
        )}

        {/* Answer input */}
        {!lastFeedback && (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <textarea
                className="w-full h-48 bg-white border border-gray-300 rounded-2xl p-6 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none leading-relaxed shadow-sm"
                placeholder="Type your answer here, or click the mic to speak…"
                value={answerText}
                onChange={e => setAnswerText(e.target.value)}
              />
              <div className="absolute bottom-6 right-6 flex items-center gap-3">
                {/* Mic / Transcribe button */}
                <button
                  id="mic-btn"
                  onClick={handleMicClick}
                  disabled={isTranscribing}
                  title={micLabel}
                  className={`flex items-center gap-1.5 px-3 h-12 rounded-full transition-all border shadow-sm text-sm font-medium ${
                    isRecording
                      ? 'bg-red-50 text-red-600 border-red-300 animate-pulse'
                      : isTranscribing
                      ? 'bg-purple-50 text-primary border-primary/30'
                      : 'bg-white text-gray-500 hover:text-gray-900 border-gray-300'
                  }`}>
                  {micIcon}
                  <span>{micLabel}</span>
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={submitting || !answerText.trim() || micBusy}
                  className="flex items-center gap-2 px-6 py-3 rounded-full bg-primary text-white shadow-sm hover:bg-primary/90 transition-all font-bold disabled:opacity-50">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit Answer
                </button>
              </div>
            </div>

            {/* Transcription error */}
            {transcribeError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {transcribeError}
              </p>
            )}

            {/* Recording indicator */}
            {isRecording && (
              <p className="text-xs text-red-500 font-medium flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                Recording… Click Stop when done.
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        {lastFeedback && (
          <div className="flex gap-3 justify-end">
            {!isLast ? (
              <button onClick={handleNext}
                className="px-8 py-3 rounded-full bg-primary text-white font-bold hover:bg-primary/90 transition-all">
                Next Question →
              </button>
            ) : (
              <button onClick={handleComplete} disabled={completing}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-all disabled:opacity-60">
                {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Complete Interview & Get Report
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
