# SOP: Automated Testing & Verification Protocol

## 1. Automated Test Suite Specifications
All code changes must be verified using automated Python test scripts located in `scratch/`:
1. **`scratch/test_admin_and_supabase.py`:**
   - Test 1: Insert new trip into Supabase with all 24 macros.
   - Test 2: Verify unique itinerary readback from Supabase REST API.
   - Test 3: Update existing trip record in-place via UPSERT.
   - Test 4: Delete test record and verify database cleanup.
2. **`scratch/test_card_stack_flip.py`:**
   - Test 1: Verify `CardStackManager` initialization and event delegation logic.
   - Test 2: Simulate 4 consecutive card flip rotations to verify `data-pos` state transitions.

## 2. Regression Testing Procedure
Run terminal command:
```bash
python3 scratch/test_admin_and_supabase.py
```
Expected output:
```text
=== ALL 4 AUTOMATED TESTS PASSED SUCCESSFULLY! ===
```
