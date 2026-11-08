//! One change to a flow's steps at a time, the same for the Flows screen and the single-step
//! API the CLI and MCP tools use.

/// Inserts at `position`, clamped to the list; the end when none is given.
pub fn add_flow_step<Step>(flow_steps: &mut Vec<Step>, added_step: Step, position: Option<usize>) {
    let insert_at = position.unwrap_or(flow_steps.len()).min(flow_steps.len());
    flow_steps.insert(insert_at, added_step);
}

/// Moves one step to `position`, clamped to the list; false when there is no such step.
pub fn move_flow_step<Step>(
    flow_steps: &mut Vec<Step>,
    step_index: usize,
    position: usize,
) -> bool {
    if step_index >= flow_steps.len() {
        return false;
    }
    let moved_step = flow_steps.remove(step_index);
    let insert_at = position.min(flow_steps.len());
    flow_steps.insert(insert_at, moved_step);
    true
}

/// False when there is no such step.
pub fn remove_flow_step<Step>(flow_steps: &mut Vec<Step>, step_index: usize) -> bool {
    if step_index >= flow_steps.len() {
        return false;
    }
    flow_steps.remove(step_index);
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_moves_and_removes_one_step_at_a_time() {
        let mut flow_steps = vec!["account_number", "pin"];

        add_flow_step(&mut flow_steps, "otp", Some(1));
        assert_eq!(flow_steps, ["account_number", "otp", "pin"]);
        add_flow_step(&mut flow_steps, "confirm", Some(99));
        assert_eq!(flow_steps.last(), Some(&"confirm"));
        assert!(move_flow_step(&mut flow_steps, 3, 0));
        assert_eq!(flow_steps[0], "confirm");
        assert!(remove_flow_step(&mut flow_steps, 0));
        assert_eq!(flow_steps, ["account_number", "otp", "pin"]);
        assert!(!remove_flow_step(&mut flow_steps, 7));
        assert!(!move_flow_step(&mut flow_steps, 7, 0));
    }
}
