export const SCHEMA = `
CREATE TABLE IF NOT EXISTS draws (
  draw_number INTEGER PRIMARY KEY,
  draw_date   TEXT NOT NULL,
  num1        INTEGER NOT NULL,
  num2        INTEGER NOT NULL,
  num3        INTEGER NOT NULL,
  num4        INTEGER NOT NULL,
  num5        INTEGER NOT NULL,
  num6        INTEGER NOT NULL,
  additional  INTEGER NOT NULL,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prizes (
  draw_number INTEGER NOT NULL,
  group_num   INTEGER NOT NULL,
  share_amount REAL,
  winners     INTEGER NOT NULL,
  PRIMARY KEY (draw_number, group_num),
  FOREIGN KEY (draw_number) REFERENCES draws(draw_number)
);
`;
