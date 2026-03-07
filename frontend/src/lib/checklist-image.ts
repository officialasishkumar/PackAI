import { CATEGORIES, Trip, TripItem, formatTripLocation } from "@/lib/types";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export async function downloadTripChecklistImage(trip: Trip): Promise<void> {
  const width = 1080;
  const sections = buildSections(trip.items);
  const layout = measureLayout(sections);
  const height = Math.max(1600, layout.height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot generate checklist images.");
  }

  drawBackground(context, width, height);

  let y = 72;
  drawRoundedRect(context, 54, 40, width - 108, 180, 34, "#fffaf4", 1);
  context.fillStyle = "#96381c";
  context.font = "500 28px 'IBM Plex Mono', monospace";
  context.fillText("PackAI checklist", 88, y);

  y += 52;
  context.fillStyle = "#102231";
  context.font = "700 58px 'Space Grotesk', sans-serif";
  context.fillText(truncate(trip.trip_name, 26), 88, y);

  y += 46;
  context.fillStyle = "rgba(16,34,49,0.7)";
  context.font = "400 26px 'Space Grotesk', sans-serif";
  context.fillText(
    `Created ${DATE_FORMATTER.format(new Date(trip.created_at))}`,
    88,
    y,
  );

  y += 40;
  context.fillText(
    trip.location
      ? `Shared location: ${formatTripLocation(trip.location)}`
      : "Location not shared",
    88,
    y,
  );

  for (const column of layout.columns) {
    for (const section of column.sections) {
      drawRoundedRect(
        context,
        section.x,
        section.y,
        section.width,
        section.height,
        30,
        "#ffffff",
        0.92,
      );

      context.fillStyle = "#96381c";
      context.font = "500 24px 'IBM Plex Mono', monospace";
      context.fillText(section.title.toUpperCase(), section.x + 30, section.y + 42);

      let rowY = section.y + 84;
      for (const item of section.items) {
        drawChecklistRow(context, item, section.x + 30, rowY, section.width - 60);
        rowY += 58;
      }
    }
  }

  const link = document.createElement("a");
  link.download = `${slugify(trip.trip_name)}-checklist.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function measureLayout(sections: ChecklistSection[]) {
  const columnCount =
    sections.length > 12 ? 3 : sections.reduce((sum, section) => sum + section.height, 300) > 5200 ? 2 : 1;
  const gap = 24;
  const startY = 260;
  const horizontalPadding = 54;
  const columnWidth =
    (1080 - horizontalPadding * 2 - gap * (columnCount - 1)) / columnCount;

  const columns = Array.from({ length: columnCount }, (_, index) => ({
    x: horizontalPadding + index * (columnWidth + gap),
    y: startY,
    sections: [] as Array<ChecklistSection & { x: number; y: number; width: number }>,
  }));

  for (const section of sections) {
    const target = columns.reduce((shortest, current) =>
      current.y < shortest.y ? current : shortest,
    );
    target.sections.push({
      ...section,
      x: target.x,
      y: target.y,
      width: columnWidth,
    });
    target.y += section.height + gap;
  }

  return {
    height: Math.max(...columns.map((column) => column.y)) + 40,
    columns,
  };
}

interface ChecklistSection {
  title: string;
  items: TripItem[];
  height: number;
}

function buildSections(items: TripItem[]) {
  const sections: ChecklistSection[] = [];
  for (const group of CATEGORIES.map((category) => ({
    category,
    items: items.filter((item) => item.category === category),
  })).filter((group) => group.items.length > 0)) {
    const chunks = chunkItems(group.items, 14);
    chunks.forEach((chunk, index) => {
      sections.push({
        title: index === 0 ? group.category : `${group.category} cont.`,
        items: chunk,
        height: 66 + chunk.length * 58,
      });
    });
  }

  return sections;
}

function drawBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#f7f1e8");
  gradient.addColorStop(1, "#efe4d1");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const accent = context.createRadialGradient(width * 0.85, 100, 20, width * 0.85, 100, 280);
  accent.addColorStop(0, "rgba(206,95,62,0.35)");
  accent.addColorStop(1, "rgba(206,95,62,0)");
  context.fillStyle = accent;
  context.fillRect(0, 0, width, height);
}

function drawChecklistRow(
  context: CanvasRenderingContext2D,
  item: TripItem,
  x: number,
  y: number,
  width: number,
) {
  context.strokeStyle = "rgba(16,34,49,0.1)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(x, y + 38);
  context.lineTo(x + width, y + 38);
  context.stroke();

  context.beginPath();
  context.lineWidth = 2;
  context.strokeStyle = "rgba(16,34,49,0.22)";
  context.arc(x + 16, y + 16, 12, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#102231";
  context.font = "600 28px 'Space Grotesk', sans-serif";
  context.fillText(truncate(item.name, 30), x + 44, y + 14);

  context.fillStyle = "rgba(16,34,49,0.68)";
  context.font = "400 22px 'Space Grotesk', sans-serif";
  context.fillText(`Qty ${item.quantity} · ${item.added_by}`, x + 44, y + 42);
}

function chunkItems(items: TripItem[], size: number) {
  const chunks: TripItem[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  alpha: number,
) {
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = fill;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
  context.fill();
  context.restore();
}

function slugify(value: string): string {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "packai";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}…`;
}
