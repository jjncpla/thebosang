const fs = require('fs');

const input = `
[
  {
    "name": "victimName",
    "x": 180,
    "y": 310,
    "w": 140,
    "h": 18
  }
]
`;

function convertToFieldConfig(jsonInput) {
  const fields = JSON.parse(jsonInput);

  const lines = fields.map(f => {
    if (f.type === 'split') {
      const first = f.positions[0];

      const y = Math.round(first.y);
      const x = Math.round(first.x);
      const w = Math.round(first.w);
      const h = Math.round(first.h);

      let gap = 1;
      if (f.positions.length > 1) {
        const second = f.positions[1];
        gap = Math.round(second.x - first.x - w);
      }

      const count = f.positions.length;

      return `${f.name}: splitRow(${y}, ${x}, ${w}, ${h}, ${count}, ${gap}),`;
    }

    return `${f.name}: pos(${Math.round(f.x)}, ${Math.round(f.y)}, ${Math.round(f.w)}, ${Math.round(f.h)}),`;
  });

  return lines.join('\n');
}

console.log(convertToFieldConfig(input));