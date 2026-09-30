import { createElement } from 'react';
import { Book, Code, FlaskConical, Calculator, PenLine, Globe, Lightbulb, Music, Palette, Rocket, Brain, GraduationCap } from 'lucide-react';

// The icon a space was given when it was created (see CreateSpaceModal)
export const SPACE_ICONS = {
  book: Book,
  code: Code,
  flask: FlaskConical,
  calculator: Calculator,
  pen: PenLine,
  globe: Globe,
  lightbulb: Lightbulb,
  music: Music,
  palette: Palette,
  rocket: Rocket,
  brain: Brain,
  graduation: GraduationCap,
};

export const spaceIcon = (key) => SPACE_ICONS[key] || Book;
export const spaceColor = (space) => space?.color || '#6366f1';

/** A space's icon, e.g. <SpaceGlyph icon={space.icon} size={18} /> */
export function SpaceGlyph({ icon, ...props }) {
  return createElement(spaceIcon(icon), props);
}
