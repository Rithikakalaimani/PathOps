package pathops.engine;

import java.util.Collections;
import java.util.List;

/**
 * Result of a shortest path query: total distance and optional path sequence.
 */
public final class PathResult {

    private final double distance;
    private final List<Integer> path;
    private final boolean reachable;

    public static PathResult unreachable() {
        return new PathResult(Double.POSITIVE_INFINITY, List.of(), false);
    }

    public static PathResult of(double distance, List<Integer> path) {
        return new PathResult(distance, path, true);
    }

    private PathResult(double distance, List<Integer> path, boolean reachable) {
        this.distance = distance;
        this.path = path;
        this.reachable = reachable;
    }

    public double getDistance() { return distance; }
    public List<Integer> getPath() { return Collections.unmodifiableList(path); }
    public boolean isReachable() { return reachable; }
}
