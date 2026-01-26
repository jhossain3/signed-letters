import { Eraser, Undo2, Trash2, Pen } from "lucide-react";
import { Button } from "../ui/button";

interface SketchToolbarProps {
  isEraser: boolean;
  canUndo: boolean;
  onPenClick: () => void;
  onEraserClick: () => void;
  onUndoClick: () => void;
  onClearClick: () => void;
}

const SketchToolbar = ({
  isEraser,
  canUndo,
  onPenClick,
  onEraserClick,
  onUndoClick,
  onClearClick,
}: SketchToolbarProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2 bg-card/80 rounded-xl border border-border/50">
      {/* Pen Tool */}
      <Button
        type="button"
        variant={!isEraser ? "default" : "outline"}
        size="sm"
        onClick={onPenClick}
        className="rounded-full"
        title="Pen"
      >
        <Pen className="w-4 h-4" />
      </Button>

      {/* Eraser Tool */}
      <Button
        type="button"
        variant={isEraser ? "default" : "outline"}
        size="sm"
        onClick={onEraserClick}
        className="rounded-full"
        title="Eraser"
      >
        <Eraser className="w-4 h-4" />
      </Button>

      <div className="flex-1" />

      {/* Undo */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onUndoClick}
        disabled={!canUndo}
        className="rounded-full"
        title="Undo"
      >
        <Undo2 className="w-4 h-4" />
      </Button>

      {/* Clear */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClearClick}
        className="rounded-full text-destructive hover:text-destructive"
        title="Clear Canvas"
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  );
};

export default SketchToolbar;
