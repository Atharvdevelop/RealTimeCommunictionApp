import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X, Pen, Eraser, Square, Circle, ArrowRight, Type, Trash2,
  Undo2, Redo2, Download, MousePointer2,
} from 'lucide-react';
import { useRoom } from '@/hooks/useRoom';
import type { WhiteboardStroke, WhiteboardTool, RemoteCursor } from '@/lib/types';
import { cn } from '@/lib/utils';

type Props = { onClose: () => void };

const COLORS = ['#10b981', '#06b6d4', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#000000'];
const SIZES = [2, 4, 8, 14];

type Shape = {
  tool: WhiteboardTool;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  size: number;
};

export function Whiteboard({ onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<WhiteboardTool>('pen');
  const [color, setColor] = useState('#10b981');
  const [size, setSize] = useState(4);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null);
  const shapeSnapshotRef = useRef<ImageData | null>(null);
  const cursorEmitRef = useRef<number>(0);
  const { broadcastStroke, broadcastCursor, onStroke, onClear, remoteCursors, clearWhiteboard } = useRoom();

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    return canvasRef.current?.getContext('2d') ?? null;
  }, []);

  // Resize canvas to container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.putImageData(snapshot, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas]);

  const drawStroke = useCallback(
    (stroke: WhiteboardStroke, ctxOverride?: CanvasRenderingContext2D) => {
      const ctx = ctxOverride ?? getCtx();
      if (!ctx) return;
      ctx.strokeStyle = stroke.color;
      ctx.fillStyle = stroke.color;
      ctx.lineWidth = stroke.size;

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(stroke.prevX, stroke.prevY);
        ctx.lineTo(stroke.currX, stroke.currY);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else if (stroke.tool === 'pen') {
        ctx.beginPath();
        ctx.moveTo(stroke.prevX, stroke.prevY);
        ctx.lineTo(stroke.currX, stroke.currY);
        ctx.stroke();
      }
    },
    [getCtx]
  );

  const drawShape = useCallback(
    (shape: Shape, ctxOverride?: CanvasRenderingContext2D) => {
      const ctx = ctxOverride ?? getCtx();
      if (!ctx) return;
      ctx.strokeStyle = shape.color;
      ctx.fillStyle = 'transparent';
      ctx.lineWidth = shape.size;

      if (shape.tool === 'rect') {
        ctx.beginPath();
        ctx.rect(shape.startX, shape.startY, shape.endX - shape.startX, shape.endY - shape.startY);
        ctx.stroke();
      } else if (shape.tool === 'circle') {
        const dx = shape.endX - shape.startX;
        const dy = shape.endY - shape.startY;
        const r = Math.sqrt(dx * dx + dy * dy);
        ctx.beginPath();
        ctx.arc(shape.startX, shape.startY, r, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(shape.startX, shape.startY);
        ctx.lineTo(shape.endX, shape.endY);
        ctx.stroke();
        // Arrowhead
        const angle = Math.atan2(shape.endY - shape.startY, shape.endX - shape.startX);
        const headLen = Math.max(10, shape.size * 3);
        ctx.beginPath();
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(shape.endX - headLen * Math.cos(angle - Math.PI / 6), shape.endY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(shape.endX, shape.endY);
        ctx.lineTo(shape.endX - headLen * Math.cos(angle + Math.PI / 6), shape.endY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    },
    [getCtx]
  );

  // Receive remote strokes
  useEffect(() => {
    const offStroke = onStroke((stroke) => {
      if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
        drawStroke(stroke);
      } else {
        drawShape({
          tool: stroke.tool,
          startX: stroke.prevX,
          startY: stroke.prevY,
          endX: stroke.currX,
          endY: stroke.currY,
          color: stroke.color,
          size: stroke.size,
        });
      }
    });
    const offClear = onClear(() => {
      const ctx = getCtx();
      const canvas = canvasRef.current;
      if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHistory([]);
      setRedoStack([]);
    });
    return () => { offStroke(); offClear(); };
  }, [onStroke, onClear, drawStroke, drawShape, getCtx]);

  const saveHistory = useCallback(() => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    setHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)].slice(-50));
    setRedoStack([]);
  }, [getCtx]);

  const getPos = (e: React.MouseEvent | React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent) => {
    e.preventDefault();
    const { x, y } = getPos(e);
    drawingRef.current = true;
    lastPointRef.current = { x, y };

    if (tool === 'pen' || tool === 'eraser') {
      // Draw a dot for click without drag
      drawStroke({ prevX: x, prevY: y, currX: x, currY: y, color, size, tool });
      broadcastStroke({ prevX: x, prevY: y, currX: x, currY: y, color, size, tool });
    } else {
      shapeStartRef.current = { x, y };
      const ctx = getCtx();
      const canvas = canvasRef.current;
      if (ctx && canvas) shapeSnapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  };

  const moveDraw = (e: React.PointerEvent) => {
    // Cursor broadcast (throttled)
    const now = performance.now();
    if (now - cursorEmitRef.current > 50) {
      const { x, y } = getPos(e);
      broadcastCursor({ x, y });
      cursorEmitRef.current = now;
    }

    if (!drawingRef.current) return;
    const { x, y } = getPos(e);

    if (tool === 'pen' || tool === 'eraser') {
      const last = lastPointRef.current!;
      drawStroke({ prevX: last.x, prevY: last.y, currX: x, currY: y, color, size, tool });
      broadcastStroke({ prevX: last.x, prevY: last.y, currX: x, currY: y, color, size, tool });
      lastPointRef.current = { x, y };
    } else {
      // Live shape preview
      const ctx = getCtx();
      const canvas = canvasRef.current;
      const start = shapeStartRef.current!;
      if (ctx && canvas && shapeSnapshotRef.current) {
        ctx.putImageData(shapeSnapshotRef.current, 0, 0);
        drawShape({ tool, startX: start.x, startY: start.y, endX: x, endY: y, color, size });
      }
    }
  };

  const endDraw = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const { x, y } = getPos(e);

    if (tool !== 'pen' && tool !== 'eraser') {
      const start = shapeStartRef.current!;
      drawShape({ tool, startX: start.x, startY: start.y, endX: x, endY: y, color, size });
      broadcastStroke({ prevX: start.x, prevY: start.y, currX: x, currY: y, color, size, tool });
    }
    shapeStartRef.current = null;
    shapeSnapshotRef.current = null;
    saveHistory();
  };

  const undo = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || history.length === 0) return;
    const last = history[history.length - 1];
    setRedoStack((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    setHistory((prev) => prev.slice(0, -1));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(last, 0, 0);
  };

  const redo = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (!ctx || !canvas || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    setRedoStack((prev) => prev.slice(0, -1));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(next, 0, 0);
  };

  const clearCanvas = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
    clearWhiteboard();
    setHistory([]);
    setRedoStack([]);
  };

  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `pulsemeet-whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const tools: { tool: WhiteboardTool; icon: React.ReactNode; label: string }[] = [
    { tool: 'pen', icon: <Pen className="w-4 h-4" />, label: 'Pen' },
    { tool: 'eraser', icon: <Eraser className="w-4 h-4" />, label: 'Eraser' },
    { tool: 'rect', icon: <Square className="w-4 h-4" />, label: 'Rectangle' },
    { tool: 'circle', icon: <Circle className="w-4 h-4" />, label: 'Circle' },
    { tool: 'arrow', icon: <ArrowRight className="w-4 h-4" />, label: 'Arrow' },
    { tool: 'text', icon: <Type className="w-4 h-4" />, label: 'Text' },
  ];

  return (
    <div className="fixed inset-0 z-[55] bg-[#09090b] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#121215]/80 backdrop-blur-xl border-b border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center">
            <Pen className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white text-sm">Collaborative Whiteboard</span>
          <span className="text-xs text-white/30 hidden sm:inline">Live · drawing with everyone in the room</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#18181b] border border-white/[0.08] text-white/70 hover:text-white text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" /> Close
        </button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden bg-[#0f0f12]">
        <canvas
          ref={canvasRef}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          className="absolute inset-0 touch-none"
          style={{ cursor: tool === 'eraser' ? 'crosshair' : 'crosshair' }}
        />

        {/* Remote cursors */}
        {Object.values(remoteCursors).map((c: RemoteCursor) => (
          <div
            key={c.id}
            className="absolute pointer-events-none transition-all duration-75 ease-out z-10"
            style={{ left: c.x, top: c.y }}
          >
            <MousePointer2 className="w-5 h-5" style={{ color: c.color, fill: c.color }} />
            <span
              className="absolute left-4 top-4 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white whitespace-nowrap"
              style={{ background: c.color }}
            >
              {c.name}
            </span>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#121215]/90 backdrop-blur-xl border-t border-white/[0.08] overflow-x-auto gap-3 shrink-0">
        {/* Tools */}
        <div className="flex items-center gap-1 rounded-xl bg-[#18181b] p-1 shrink-0">
          {tools.map((t) => (
            <button
              key={t.tool}
              onClick={() => setTool(t.tool)}
              title={t.label}
              className={cn(
                'p-2 rounded-lg transition-all shrink-0',
                tool === t.tool ? 'bg-emerald-500/20 text-emerald-400' : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
            >
              {t.icon}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1.5 shrink-0">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={cn(
                'w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-all shrink-0',
                color === c ? 'border-white scale-110' : 'border-white/20 hover:scale-105'
              )}
              style={{ background: c }}
            />
          ))}
        </div>

        {/* Size slider */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] sm:text-xs text-white/40">Size</span>
          <div className="flex items-center gap-1">
            {SIZES.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={cn(
                  'w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all',
                  size === s ? 'bg-white/10' : 'hover:bg-white/5'
                )}
              >
                <div
                  className="rounded-full"
                  style={{ width: s, height: s, background: color }}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={undo} disabled={history.length === 0} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors" title="Undo">
            <Undo2 className="w-4 h-4" />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors" title="Redo">
            <Redo2 className="w-4 h-4" />
          </button>
          <button onClick={exportPNG} className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors" title="Export PNG">
            <Download className="w-4 h-4" />
          </button>
          <button onClick={clearCanvas} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors" title="Clear Canvas">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
