'use client';

// =============================================================================
// FeedbackComposer - Text and voice feedback with AI assistance
// =============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import type { FeedbackInput, CompetencyId, Grade } from '@/types';

interface FeedbackComposerProps {
  studentName: string;
  submissionContent?: string;
  currentGrades: Partial<Record<CompetencyId, Grade>>;
  onFeedbackChange: (feedback: FeedbackInput) => void;
  onGenerateAI: () => void;
  isGenerating?: boolean;
}

export function FeedbackComposer({
  studentName,
  submissionContent,
  currentGrades,
  onFeedbackChange,
  onGenerateAI,
  isGenerating = false,
}: FeedbackComposerProps) {
  const [textFeedback, setTextFeedback] = useState('');
  const [voiceNote, setVoiceNote] = useState<Blob | null>(null);
  const [voiceDuration, setVoiceDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Update parent when feedback changes
  useEffect(() => {
    onFeedbackChange({
      text: textFeedback,
      voiceNote: voiceNote || undefined,
      voiceDurationSeconds: voiceDuration,
    });
  }, [textFeedback, voiceNote, voiceDuration, onFeedbackChange]);

  // Start voice recording
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setVoiceNote(blob);
        setVoiceDuration(recordingTime);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  }, [recordingTime]);

  // Stop voice recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [isRecording]);

  // Clear voice note
  const clearVoiceNote = useCallback(() => {
    setVoiceNote(null);
    setVoiceDuration(0);
  }, []);

  // Count graded competencies
  const gradedCount = Object.keys(currentGrades).length;
  const hasContent = textFeedback.trim().length > 0 || voiceNote !== null;

  return (
    <div className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm text-text-muted">
          FEEDBACK FOR {studentName.toUpperCase()}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">
            {gradedCount}/9 competencies
          </span>
          {hasContent && (
            <span className="text-xs text-accent-primary">✓ Has feedback</span>
          )}
        </div>
      </div>

      {/* Text Input */}
      <div className="flex-1 mb-3">
        <textarea
          value={textFeedback}
          onChange={(e) => setTextFeedback(e.target.value)}
          placeholder="Type your feedback here, or use voice recording below..."
          className="w-full h-full p-3 bg-surface/50 border border-surface rounded-lg
                     text-text-primary placeholder-text-muted text-sm resize-none
                     focus:outline-none focus:border-accent-primary transition-colors"
        />
      </div>

      {/* Voice Recording Section */}
      <div className="flex items-center gap-3 mb-3">
        {!isRecording && !voiceNote && (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg
                       hover:bg-surface/80 transition-colors text-text-primary"
          >
            <span className="text-accent-danger">🎙️</span>
            <span className="text-sm">Record Voice Note</span>
          </button>
        )}

        {isRecording && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-accent-danger rounded-full animate-pulse" />
              <span className="text-sm text-text-primary font-mono">
                {formatTime(recordingTime)}
              </span>
            </div>
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-accent-danger/20
                         border border-accent-danger rounded-lg text-accent-danger
                         hover:bg-accent-danger/30 transition-colors"
            >
              <span>⏹️</span>
              <span className="text-sm">Stop Recording</span>
            </button>
          </div>
        )}

        {voiceNote && !isRecording && (
          <div className="flex items-center gap-3 flex-1">
            <div className="flex items-center gap-2 px-3 py-2 bg-accent-primary/20
                            border border-accent-primary rounded-lg">
              <span>🎵</span>
              <span className="text-sm text-accent-primary">
                Voice note ({formatTime(voiceDuration)})
              </span>
            </div>
            <AudioPlayer audioBlob={voiceNote} />
            <button
              onClick={clearVoiceNote}
              className="p-2 text-text-muted hover:text-accent-danger transition-colors"
              title="Delete voice note"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-3">
        <button
          onClick={onGenerateAI}
          disabled={isGenerating || gradedCount === 0}
          className={`
            flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg
            font-display text-sm transition-all
            ${isGenerating || gradedCount === 0
              ? 'bg-surface text-text-muted cursor-not-allowed'
              : 'bg-gradient-to-r from-accent-secondary to-accent-primary text-background hover:opacity-90'
            }
          `}
        >
          {isGenerating ? (
            <>
              <span className="animate-spin">⚡</span>
              <span>GENERATING...</span>
            </>
          ) : (
            <>
              <span>🤖</span>
              <span>GENERATE AI FEEDBACK</span>
            </>
          )}
        </button>

        <FeedbackTemplates onSelect={(template) => setTextFeedback(template)} />
      </div>

      {/* Hint */}
      {gradedCount === 0 && (
        <p className="text-xs text-text-muted mt-2 text-center">
          Score at least one competency to enable AI feedback generation
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Audio Player
// =============================================================================

function AudioPlayer({ audioBlob }: { audioBlob: Blob }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    urlRef.current = URL.createObjectURL(audioBlob);
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
      }
    };
  }, [audioBlob]);

  const togglePlay = () => {
    if (!audioRef.current && urlRef.current) {
      audioRef.current = new Audio(urlRef.current);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <button
      onClick={togglePlay}
      className="p-2 text-text-primary hover:text-accent-primary transition-colors"
      title={isPlaying ? 'Stop' : 'Play'}
    >
      {isPlaying ? '⏹️' : '▶️'}
    </button>
  );
}

// =============================================================================
// Feedback Templates
// =============================================================================

const TEMPLATES = [
  {
    name: 'Great Work',
    text: 'Excellent work on this assignment! Your understanding of the core concepts is clear, and your execution demonstrates strong technical skills.',
  },
  {
    name: 'Needs Improvement',
    text: 'This submission shows promise, but there are areas that need more attention. Consider revisiting the key concepts and strengthening your approach.',
  },
  {
    name: 'Missing Elements',
    text: 'Your submission is missing some required elements. Please review the assignment requirements and ensure all components are addressed.',
  },
  {
    name: 'Strong Concept',
    text: 'Your conceptual approach is strong, showing good understanding of the design principles. Focus on refining the execution to match your vision.',
  },
];

function FeedbackTemplates({ onSelect }: { onSelect: (template: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-3 bg-surface rounded-lg text-text-muted
                   hover:bg-surface/80 transition-colors text-sm"
      >
        📋 Templates
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute bottom-full right-0 mb-2 w-64 bg-background
                          border border-surface rounded-lg shadow-xl z-50">
            <div className="p-2">
              <p className="text-xs text-text-muted px-2 py-1 mb-1">
                QUICK TEMPLATES
              </p>
              {TEMPLATES.map((template) => (
                <button
                  key={template.name}
                  onClick={() => {
                    onSelect(template.text);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-text-primary
                             hover:bg-surface rounded transition-colors"
                >
                  {template.name}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
