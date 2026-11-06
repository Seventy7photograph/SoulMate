interface CustomCompanionProps {
  name: string;
  imageUrl: string;
  zoom: number;
}

export function CustomCompanion({
  name,
  imageUrl,
  zoom,
}: CustomCompanionProps) {
  return (
    <div className="custom-companion-frame" data-testid="custom-companion">
      <img
        src={imageUrl}
        alt={`${name} 自定义形象`}
        style={{ transform: `scale(${zoom})` }}
      />
    </div>
  );
}

