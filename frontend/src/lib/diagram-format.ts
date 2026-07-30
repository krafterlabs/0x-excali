/** Diagram file format constants (compatible with the embedded canvas library). */
export const DIAGRAM_FILE_EXTENSION = '.excalidraw';
export const DIAGRAM_JSON_TYPE = 'excalidraw';

export function isDiagramFile(name: string): boolean {
  return name.endsWith(DIAGRAM_FILE_EXTENSION);
}

export function withDiagramExtension(name: string): string {
  return name.endsWith(DIAGRAM_FILE_EXTENSION) ? name : `${name}${DIAGRAM_FILE_EXTENSION}`;
}
