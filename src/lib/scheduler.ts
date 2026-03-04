import { User, Category, ScheduleAssignment } from "../types";

export function generateAutoSchedule(
  users: User[],
  categories: Category[]
): ScheduleAssignment[] {
  const assignments: ScheduleAssignment[] = [];
  const assignedUserIds = new Set<string>();

  // Filter only active users
  const activeUsers = users.filter((u) => u.isActive);

  for (const category of categories) {
    // 1. Get available users who:
    //    - Are linked to this specific category
    //    - Are not already assigned to another category in this event
    const availableUsers = activeUsers.filter(
      (u) => u.linkedCategories.includes(category.id) && !assignedUserIds.has(u.id)
    );

    if (availableUsers.length === 0) {
      // If no users available for this category, we might leave it unassigned or pick any available (if that was the rule)
      // But based on requirement 2: "only suggest for functions linked in profile"
      continue;
    }

    // 2. Sort by:
    //    a. priorityReplenishment (true first)
    //    b. lastDate for this specific category (null first, then oldest date)
    //    c. historyCount (lowest first - optional tie-breaker)
    const sortedUsers = [...availableUsers].sort((a, b) => {
      // Rule 1: Priority replenishment
      if (a.priorityReplenishment && !b.priorityReplenishment) return -1;
      if (!a.priorityReplenishment && b.priorityReplenishment) return 1;

      // Rule 2: Time since last performing this category (FIFO)
      const lastDateA = a.roleStats[category.id]?.lastDate;
      const lastDateB = b.roleStats[category.id]?.lastDate;

      if (!lastDateA && lastDateB) return -1;
      if (lastDateA && !lastDateB) return 1;
      if (!lastDateA && !lastDateB) return a.historyCount - b.historyCount;

      return (
        new Date(lastDateA!).getTime() - new Date(lastDateB!).getTime() ||
        a.historyCount - b.historyCount
      );
    });

    const selectedUser = sortedUsers[0];

    if (selectedUser) {
      assignments.push({
        categoryId: category.id,
        userId: selectedUser.id,
        confirmed: false,
        assignedBy: 'auto' // Add visual indicator source
      });
      assignedUserIds.add(selectedUser.id);
    }
  }

  return assignments;
}
