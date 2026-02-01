'use client';

// =============================================================================
// BatchUploadModal - Batch PDF upload with student name matching
// =============================================================================

import { useState, useCallback, useRef, useEffect } from 'react';
import { getPDFImagesForAI, type PDFPage } from './PDFViewer';
import { getConfidenceBadge } from '@/lib/matching';
import type { CanvasSubmission, BatchAttachment, BatchFileInfo, StudentMatch } from '@/types';

type Phase = 'upload' | 'matching' | 'ready';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  submissions: CanvasSubmission[];
  onAttachToSubmissions: (attachments: Map<number, BatchAttachment>) => void;
}

export function BatchUploadModal({
  isOpen,
  onClose,
  submissions,
  onAttachToSubmissions,
}: BatchUploadModalProps) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [files, setFiles] = useState<BatchFileInfo[]>([]);
  const [matches, setMatches] = useState<StudentMatch[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setPhase('upload');
      setFiles([]);
      setMatches([]);
    }
  }, [isOpen]);

  // Handle file selection
  const handleFiles = useCallback(async (selectedFiles: FileList | File[]) => {
    const pdfFiles = Array.from(selectedFiles).filter(
      (file) => file.type === 'application/pdf'
    );

    if (pdfFiles.length === 0) return;

    // Create file info entries
    const newFiles: BatchFileInfo[] = pdfFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      filename: file.name,
      extractedText: null,
      pdfImages: [],
      isProcessing: true,
      error: null,
    }));

    setFiles((prev) => [...prev, ...newFiles]);

    // Process each PDF
    for (const fileInfo of newFiles) {
      try {
        const { images } = await processPDF(fileInfo.file);
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileInfo.id
              ? { ...f, pdfImages: images, isProcessing: false }
              : f
          )
        );
      } catch (error) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileInfo.id
              ? {
                  ...f,
                  isProcessing: false,
                  error: error instanceof Error ? error.message : 'Failed to process PDF',
                }
              : f
          )
        );
      }
    }
  }, []);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  // Remove a file
  const handleRemoveFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Match files to students
  const handleMatchToStudents = useCallback(async () => {
    if (files.length === 0) return;

    setIsMatching(true);

    try {
      // Build student list from submissions
      const students = submissions
        .filter((s) => s.user)
        .map((s) => ({
          id: s.user_id,
          name: s.user!.name,
          sortableName: s.user!.sortable_name,
        }));

      // Call matching API
      const response = await fetch('/api/match-students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: files.map((f) => ({ id: f.id, name: f.filename })),
          students,
        }),
      });

      if (!response.ok) throw new Error('Matching failed');

      const data = await response.json();

      // Convert API response to StudentMatch format
      const studentMatches: StudentMatch[] = data.matches.map(
        (match: {
          fileId: string;
          filename: string;
          matchedStudent: { id: number; name: string } | null;
          confidence: number;
          alternatives: Array<{ student: { id: number; name: string }; score: number }>;
        }) => ({
          fileId: match.fileId,
          filename: match.filename,
          matchedStudentId: match.matchedStudent?.id || null,
          matchedStudentName: match.matchedStudent?.name || null,
          confidence: match.confidence,
          alternatives: match.alternatives.map((alt) => ({
            id: alt.student.id,
            name: alt.student.name,
            score: alt.score,
          })),
        })
      );

      setMatches(studentMatches);
      setPhase('matching');
    } catch (error) {
      console.error('Matching error:', error);
    } finally {
      setIsMatching(false);
    }
  }, [files, submissions]);

  // Update a match manually
  const handleUpdateMatch = useCallback(
    (fileId: string, studentId: number | null) => {
      const student = submissions.find((s) => s.user_id === studentId)?.user;

      setMatches((prev) =>
        prev.map((m) =>
          m.fileId === fileId
            ? {
                ...m,
                matchedStudentId: studentId,
                matchedStudentName: student?.name || null,
                confidence: studentId ? 1.0 : 0, // Manual selection = 100% confidence
              }
            : m
        )
      );
    },
    [submissions]
  );

  // Attach to submissions
  const handleAttach = useCallback(() => {
    const attachments = new Map<number, BatchAttachment>();

    for (const match of matches) {
      if (match.matchedStudentId) {
        const fileInfo = files.find((f) => f.id === match.fileId);
        if (fileInfo) {
          attachments.set(match.matchedStudentId, {
            extractedText: fileInfo.extractedText,
            pdfImages: fileInfo.pdfImages,
            filename: fileInfo.filename,
          });
        }
      }
    }

    onAttachToSubmissions(attachments);
    onClose();
  }, [matches, files, onAttachToSubmissions, onClose]);

  // Stats for the matching phase
  const matchStats = {
    total: matches.length,
    matched: matches.filter((m) => m.matchedStudentId !== null).length,
    highConfidence: matches.filter((m) => m.confidence >= 0.8).length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-background border border-surface rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-surface">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h2 className="font-display text-lg text-text-primary">
                BATCH UPLOAD
              </h2>
              <p className="text-xs text-text-muted">
                {phase === 'upload' && 'Upload PDFs to match with students'}
                {phase === 'matching' && 'Review and confirm student matches'}
                {phase === 'ready' && 'Ready to attach files'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-surface rounded-lg transition-colors text-text-muted"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {phase === 'upload' && (
            <UploadPhase
              files={files}
              isDragOver={isDragOver}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onBrowse={() => fileInputRef.current?.click()}
              onRemoveFile={handleRemoveFile}
            />
          )}

          {phase === 'matching' && (
            <MatchingPhase
              matches={matches}
              submissions={submissions}
              onUpdateMatch={handleUpdateMatch}
            />
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface bg-surface/20">
          {phase === 'upload' && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-muted">
                {files.length} PDF{files.length !== 1 ? 's' : ''} selected
                {files.some((f) => f.isProcessing) && ' (processing...)'}
              </p>
              <button
                onClick={handleMatchToStudents}
                disabled={
                  files.length === 0 ||
                  files.some((f) => f.isProcessing) ||
                  isMatching
                }
                className={`
                  px-6 py-2.5 rounded-lg font-display text-sm transition-all
                  flex items-center gap-2
                  ${
                    files.length === 0 || files.some((f) => f.isProcessing)
                      ? 'bg-surface text-text-muted cursor-not-allowed'
                      : 'bg-gradient-to-r from-accent-primary to-accent-secondary text-background hover:opacity-90'
                  }
                `}
              >
                {isMatching ? (
                  <>
                    <span className="animate-spin">⚡</span>
                    <span>MATCHING...</span>
                  </>
                ) : (
                  <>
                    <span>🎯</span>
                    <span>MATCH TO STUDENTS</span>
                  </>
                )}
              </button>
            </div>
          )}

          {phase === 'matching' && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-text-muted">
                  {matchStats.matched}/{matchStats.total} matched
                </span>
                <span className="text-accent-primary">
                  {matchStats.highConfidence} high confidence
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPhase('upload')}
                  className="px-4 py-2 rounded-lg text-sm text-text-muted hover:bg-surface transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleAttach}
                  disabled={matchStats.matched === 0}
                  className={`
                    px-6 py-2.5 rounded-lg font-display text-sm transition-all
                    flex items-center gap-2
                    ${
                      matchStats.matched === 0
                        ? 'bg-surface text-text-muted cursor-not-allowed'
                        : 'bg-gradient-to-r from-accent-gold to-accent-danger text-background hover:opacity-90'
                    }
                  `}
                >
                  <span>📎</span>
                  <span>ATTACH TO SUBMISSIONS</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
      </div>
    </div>
  );
}

// =============================================================================
// Upload Phase
// =============================================================================

interface UploadPhaseProps {
  files: BatchFileInfo[];
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onBrowse: () => void;
  onRemoveFile: (fileId: string) => void;
}

function UploadPhase({
  files,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onBrowse,
  onRemoveFile,
}: UploadPhaseProps) {
  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${
            isDragOver
              ? 'border-accent-primary bg-accent-primary/10'
              : 'border-surface hover:border-text-muted'
          }
        `}
      >
        <span className="text-5xl block mb-4">📄</span>
        <p className="text-text-primary font-display mb-2">
          DROP PDFs HERE
        </p>
        <p className="text-text-muted text-sm mb-4">
          or click to browse files
        </p>
        <button
          onClick={onBrowse}
          className="px-4 py-2 bg-surface rounded-lg text-text-primary hover:bg-surface/80 transition-colors text-sm"
        >
          Browse Files
        </button>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-sm text-text-muted">
            UPLOADED FILES
          </h3>
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 p-3 bg-surface/30 rounded-lg"
            >
              <span className="text-xl">
                {file.isProcessing ? '⏳' : file.error ? '❌' : '✅'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-primary truncate">
                  {file.filename}
                </p>
                {file.isProcessing && (
                  <p className="text-xs text-text-muted">Processing...</p>
                )}
                {file.error && (
                  <p className="text-xs text-accent-danger">{file.error}</p>
                )}
                {!file.isProcessing && !file.error && (
                  <p className="text-xs text-text-muted">
                    {file.pdfImages.length} page{file.pdfImages.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <button
                onClick={() => onRemoveFile(file.id)}
                className="p-1.5 hover:bg-surface rounded transition-colors text-text-muted"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Matching Phase
// =============================================================================

interface MatchingPhaseProps {
  matches: StudentMatch[];
  submissions: CanvasSubmission[];
  onUpdateMatch: (fileId: string, studentId: number | null) => void;
}

function MatchingPhase({
  matches,
  submissions,
  onUpdateMatch,
}: MatchingPhaseProps) {
  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const badge = getConfidenceBadge(match.confidence);

        return (
          <div
            key={match.fileId}
            className="p-3 bg-surface/30 rounded-lg space-y-2"
          >
            {/* Filename and confidence */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-text-primary font-medium truncate flex-1 mr-2">
                {match.filename}
              </p>
              {match.matchedStudentId && (
                <span
                  className={`
                    px-2 py-0.5 rounded text-xs font-display
                    ${badge.color === 'green' ? 'bg-accent-primary/20 text-accent-primary' : ''}
                    ${badge.color === 'yellow' ? 'bg-accent-gold/20 text-accent-gold' : ''}
                    ${badge.color === 'red' ? 'bg-accent-danger/20 text-accent-danger' : ''}
                  `}
                >
                  {badge.text}
                </span>
              )}
            </div>

            {/* Student dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={match.matchedStudentId || ''}
                onChange={(e) =>
                  onUpdateMatch(
                    match.fileId,
                    e.target.value ? parseInt(e.target.value) : null
                  )
                }
                className="flex-1 px-3 py-2 bg-surface border border-surface rounded-lg text-text-primary text-sm focus:outline-none focus:border-accent-primary"
              >
                <option value="">-- Select Student --</option>
                {submissions
                  .filter((s) => s.user)
                  .sort((a, b) => (a.user?.name || '').localeCompare(b.user?.name || ''))
                  .map((s) => (
                    <option key={s.user_id} value={s.user_id}>
                      {s.user?.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Alternative suggestions */}
            {!match.matchedStudentId && match.alternatives.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                <span className="text-xs text-text-muted mr-1">Suggestions:</span>
                {match.alternatives.slice(0, 4).map((alt) => (
                  <button
                    key={alt.id}
                    onClick={() => onUpdateMatch(match.fileId, alt.id)}
                    className="px-2 py-0.5 text-xs bg-surface hover:bg-accent-primary/20 text-text-muted hover:text-accent-primary rounded transition-colors"
                  >
                    {alt.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// =============================================================================
// PDF Processing Helper
// =============================================================================

async function processPDF(file: File): Promise<{ images: string[] }> {
  // Dynamically import pdfjs
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

  // Read file as array buffer
  const arrayBuffer = await file.arrayBuffer();

  // Load PDF
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const images: string[] = [];
  const MAX_DIMENSION = 1200;
  const JPEG_QUALITY = 0.6;

  // Render each page
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1 });

    // Calculate scale
    const scale = Math.min(
      MAX_DIMENSION / viewport.width,
      MAX_DIMENSION / viewport.height,
      2
    );

    const scaledViewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;

    // Render
    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
      canvas: canvas,
    }).promise;

    // Convert to data URL
    const imageDataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    images.push(imageDataUrl);
  }

  return { images };
}
