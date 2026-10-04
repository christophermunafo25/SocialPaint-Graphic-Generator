import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// testing-library unmounts between tests on its own only when Vitest runs
// with globals; this project does not, so it unmounts here.
afterEach(cleanup);
