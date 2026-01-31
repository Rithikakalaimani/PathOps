package pathops.engine;

/**
 * Represents a directed edge (from -> to) with a non-negative weight.
 */
public final class Edge {

    private final int from;
    private final int to;
    private final double weight;

    public Edge(int from, int to, double weight) {
        if (weight < 0) throw new IllegalArgumentException("Weight must be non-negative");
        this.from = from;
        this.to = to;
        this.weight = weight;
    }

    public int getFrom() { return from; }
    public int getTo() { return to; }
    public double getWeight() { return weight; }

    @Override
    public String toString() {
        return from + " -[" + weight + "]-> " + to;
    }
}
