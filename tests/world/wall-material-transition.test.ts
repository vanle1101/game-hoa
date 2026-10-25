import { readFileSync } from "node:fs";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { applyProps } from "@react-three/fiber";
import * as THREE from "three";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type Props = Record<string, unknown> & { children?: ReactNode };
type Element = ReactElement<Props>;
const source = readFileSync(new URL("../../src/components/construction/ConstructionWorld.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("ConstructionWorld.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const block = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "Block");
if (!block) throw new Error("Block component not found");
const selectors: string[] = [];
function visit(node: ts.Node) {
  if (ts.isJsxAttribute(node) && node.name.getText(ast) === "map" && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
    const expression = node.initializer.expression.getText(ast);
    if (expression.includes("wallSpec.transparent")) selectors.push(expression);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
if (selectors.length !== 1) throw new Error("Expected one wall texture selector");
const compiled = ts.transpileModule(`export ${block.getText(ast)}\nexport function selectMap(selected: boolean, wallSpec: { transparent: boolean }, wallTexture: unknown) { return ${selectors[0]}; }`, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const exported: { Block?: (props: Props) => Element; selectMap?: (selected: boolean, spec: { transparent: boolean }, texture: THREE.Texture) => THREE.Texture | null } = {};
new Function("require", "exports", "UNIT_BOX", compiled)((id: string) => {
  if (id !== "react/jsx-runtime") throw new Error(`Unexpected module ${id}`);
  return jsxRuntime;
}, exported, unitBox);
const renderBlock = exported.Block!;
const selectMap = exported.selectMap!;

function materialProps(selected: boolean, transparent: boolean, texture: THREE.Texture) {
  const element = renderBlock({ position: [.5, 1.35, 0], size: [1, 2.7, .16], color: selected ? "#38889c" : "#ccddee", map: selectMap(selected, { transparent }, texture), opacity: transparent ? .3 : 1, roughness: .44, metalness: .32 });
  const material = Children.toArray(element.props.children).find((child): child is Element => isValidElement<Props>(child) && child.type === "meshStandardMaterial");
  if (!material) throw new Error("Block material not found");
  return { element, material: material.props };
}
function snapshot(material: THREE.MeshStandardMaterial) {
  return { map: material.map, color: material.color.toArray(), emissive: material.emissive.toArray(), emissiveIntensity: material.emissiveIntensity, metalness: material.metalness, roughness: material.roughness, transparent: material.transparent, opacity: material.opacity, depthWrite: material.depthWrite };
}

describe("wall material transitions with real R3F applyProps", () => {
  it("demonstrates that undefined does not clear a retained material map", () => {
    const texture = new THREE.Texture();
    const retained = new THREE.MeshStandardMaterial();
    const fresh = new THREE.MeshStandardMaterial();
    applyProps(retained, { map: texture });
    applyProps(retained, { map: undefined });
    applyProps(fresh, { map: undefined });
    expect(retained.map).toBe(texture);
    expect(fresh.map).toBeNull();
    retained.dispose(); fresh.dispose(); texture.dispose();
  });

  it.each([[true, false], [false, true], [true, true]])("textured → selected=%s transparent=%s → textured matches fresh material", (selected, transparent) => {
    const texture = new THREE.Texture();
    const retained = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial());
    const identity = { mesh: retained.uuid, material: retained.material.uuid, geometry: retained.geometry };
    for (const [nextSelected, nextTransparent] of [[false, false], [selected, transparent], [false, false]]) {
      const next = materialProps(nextSelected, nextTransparent, texture);
      applyProps(retained, next.element.props);
      applyProps(retained.material, next.material);
      const fresh = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial());
      applyProps(fresh, next.element.props);
      applyProps(fresh.material, next.material);
      retained.updateMatrix(); fresh.updateMatrix();
      expect(retained.uuid).toBe(identity.mesh);
      expect(retained.material.uuid).toBe(identity.material);
      expect(retained.geometry).toBe(identity.geometry);
      expect(retained.matrix.elements).toEqual(fresh.matrix.elements);
      expect(snapshot(retained.material)).toEqual(snapshot(fresh.material));
      expect(retained.material.map).toBe(nextSelected || nextTransparent ? null : texture);
      expect(retained.material.color.getHexString()).toBe(nextSelected ? "38889c" : nextTransparent ? "ccddee" : "ffffff");
      fresh.material.dispose();
    }
    retained.material.dispose(); texture.dispose();
  });

  it("replaces an opaque wall texture without changing mesh geometry", () => {
    const first = new THREE.Texture(), second = new THREE.Texture();
    const material = new THREE.MeshStandardMaterial();
    applyProps(material, materialProps(false, false, first).material);
    applyProps(material, materialProps(false, false, second).material);
    expect(material.map).toBe(second);
    expect(material.color.getHexString()).toBe("ffffff");
    material.dispose(); first.dispose(); second.dispose();
  });
});
