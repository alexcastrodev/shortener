export function getRandomColor() {
  const colors = [
    'blue',
    'indigo',
    'violet',
    'grape',
    'pink',
    'red',
    'orange',
    'yellow',
    'lime',
    'green',
    'teal',
    'cyan',
  ];
  return `${colors[Math.floor(Math.random() * colors.length)]}.6`;
}

export function injectRandomColor<T extends { color?: string }>(
  items: T[]
): T[] {
  return items.map(item => ({
    ...item,
    color: getRandomColor(),
  }));
}
