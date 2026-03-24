use soroban_debugger::analyzer::symbolic::SymbolicAnalyzer;

fn fixture_wasm(name: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
        .join("wasm")
        .join(format!("{name}.wasm"))
}

#[test]
fn symbolic_preserves_distinct_inputs_with_same_return_value() {
    let wasm = fixture_wasm("same_return");
    if !wasm.exists() {
        eprintln!(
            "Skipping test: fixture not found at {}. Run tests/fixtures/build.sh to build fixtures.",
            wasm.display()
        );
        return;
    }

    let bytes = std::fs::read(&wasm).unwrap();
    let analyzer = SymbolicAnalyzer::new();
    let report = analyzer.analyze(&bytes, "same").expect("analysis failed");

    assert!(
        report.paths.len() >= 2,
        "expected at least two paths, got {}",
        report.paths.len()
    );

    // Find any return value that appears for at least 2 distinct inputs.
    let mut found = false;
    for i in 0..report.paths.len() {
        for j in (i + 1)..report.paths.len() {
            let a = &report.paths[i];
            let b = &report.paths[j];
            if a.inputs != b.inputs && a.return_value == b.return_value {
                found = true;
                break;
            }
        }
        if found {
            break;
        }
    }

    assert!(
        found,
        "expected two distinct inputs to share the same return value"
    );
}
