import { md5Hex } from "../src/content/data/md5";

const cases = [
  ["", "d41d8cd98f00b204e9800998ecf8427e"],
  ["abc", "900150983cd24fb0d6963f7d28e17f72"],
  ["The quick brown fox jumps over the lazy dog", "9e107d9d372bb6826bd81d3542a419d6"],
  ["中文测试", "089b4943ea034acfa445d050c7913e55"],
  ["3484dda0-d47e-47a9-8486-f895616d69e4", null],
];

let fail = 0;
for (const [input, expected] of cases) {
  const got = md5Hex(input);
  if (expected && got !== expected) {
    console.error(`FAIL md5(${JSON.stringify(input)}) = ${got}, want ${expected}`);
    fail++;
  } else {
    console.log(`ok md5(${JSON.stringify(input.slice(0, 24))}) = ${got}`);
  }
}
process.exit(fail ? 1 : 0);
