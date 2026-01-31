package pathops.engine;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Nested;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class DSPEngineTest {

    @Nested
    class ClassicDijkstra {
        @Test
        void singleNode() {
            Graph g = new Graph(1);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            PathResult r = engine.getShortestPath(0);
            assertTrue(r.isReachable());
            assertEquals(0, r.getDistance());
            assertEquals(List.of(0), r.getPath());
        }

        @Test
        void simplePath() {
            Graph g = new Graph(4);
            g.addEdge(0, 1, 1);
            g.addEdge(1, 2, 2);
            g.addEdge(2, 3, 1);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            PathResult r = engine.getShortestPath(3);
            assertTrue(r.isReachable());
            assertEquals(4, r.getDistance());
            assertEquals(List.of(0, 1, 2, 3), r.getPath());
        }

        @Test
        void unreachable() {
            Graph g = new Graph(3);
            g.addEdge(0, 1, 1);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            PathResult r = engine.getShortestPath(2);
            assertFalse(r.isReachable());
            assertEquals(Double.POSITIVE_INFINITY, r.getDistance());
        }
    }

    @Nested
    class IncrementalCaseA {
        @Test
        void addEdgeAfterQuery_localizedHeal() {
            Graph g = new Graph(4);
            g.addEdge(0, 1, 10);
            g.addEdge(1, 2, 10);
            g.addEdge(0, 3, 100);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            engine.getShortestPath(3);  // 100 via 0->3
            engine.addEdge(2, 3, 1);    // cheaper path 0->1->2->3 = 21
            PathResult r = engine.getShortestPath(3);
            assertTrue(r.isReachable());
            assertEquals(21, r.getDistance());
            assertEquals(List.of(0, 1, 2, 3), r.getPath());
        }

        @Test
        void decreaseWeight_localizedHeal() {
            Graph g = new Graph(3);
            g.addEdge(0, 1, 5);
            g.addEdge(1, 2, 5);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            engine.getShortestPath(2);   // 10
            engine.setEdge(0, 1, 1);     // 0->1 now 1, so 0->1->2 = 6
            PathResult r = engine.getShortestPath(2);
            assertEquals(6, r.getDistance());
        }
    }

    @Nested
    class CaseB_DirtyRecompute {
        @Test
        void removeEdge_recomputeOnQuery() {
            Graph g = new Graph(4);
            g.addEdge(0, 1, 1);
            g.addEdge(1, 2, 1);
            g.addEdge(2, 3, 1);
            g.addEdge(0, 3, 10);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            PathResult before = engine.getShortestPath(3);
            assertEquals(3, before.getDistance());
            engine.removeEdge(1, 2);  // only path 0->3 remains
            PathResult after = engine.getShortestPath(3);
            assertEquals(10, after.getDistance());
            assertEquals(List.of(0, 3), after.getPath());
        }

        @Test
        void weightIncrease_recomputeOnQuery() {
            Graph g = new Graph(3);
            g.addEdge(0, 1, 1);
            g.addEdge(1, 2, 1);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            assertEquals(2, engine.getDistance(2));
            engine.setEdge(1, 2, 100);
            assertEquals(101, engine.getDistance(2));
        }

        @Test
        void removeEdgeIntoSource_dirtyRecomputeResetsSource() {
            Graph g = new Graph(3);
            g.addEdge(0, 1, 1);
            g.addEdge(1, 2, 2);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(1);
            assertEquals(2, engine.getDistance(2));
            engine.removeEdge(0, 1);
            assertEquals(2, engine.getDistance(2));
            assertFalse(engine.getShortestPath(0).isReachable());
        }
    }

    @Nested
    class Pruning {
        @Test
        void distanceThreshold_prunesExpansion() {
            Graph g = new Graph(4);
            g.addEdge(0, 1, 1);
            g.addEdge(1, 2, 1);
            g.addEdge(0, 3, 100);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            engine.setDistanceThreshold(5);  // don't expand beyond 5
            PathResult r = engine.getShortestPath(3);
            assertFalse(r.isReachable());  // 3 is at distance 100, beyond threshold
            PathResult r2 = engine.getShortestPath(2);
            assertTrue(r2.isReachable());
            assertEquals(2, r2.getDistance());
        }
    }

    @Nested
    class BidirectionalDijkstra {
        @Test
        void sameResultAsSingleSource() {
            Graph g = new Graph(4);
            g.addEdge(0, 1, 1);
            g.addEdge(1, 2, 2);
            g.addEdge(2, 3, 1);
            g.addEdge(0, 3, 10);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            PathResult single = engine.getShortestPath(3);
            PathResult bidir = engine.getShortestPathBidirectional(0, 3);
            assertEquals(single.getDistance(), bidir.getDistance());
            assertEquals(single.getPath(), bidir.getPath());
        }

        @Test
        void unreachableBidirectional() {
            Graph g = new Graph(3);
            g.addEdge(0, 1, 1);
            DSPEngine engine = new DSPEngine(g);
            PathResult r = engine.getShortestPathBidirectional(0, 2);
            assertFalse(r.isReachable());
        }

        @Test
        void sourceEqualsTarget() {
            Graph g = new Graph(2);
            g.addEdge(0, 1, 1);
            DSPEngine engine = new DSPEngine(g);
            PathResult r = engine.getShortestPathBidirectional(0, 0);
            assertTrue(r.isReachable());
            assertEquals(0, r.getDistance());
            assertEquals(List.of(0), r.getPath());
        }
    }

    @Nested
    class BatchCaseA {
        @Test
        void multipleAddsThenQuery_flushOnce() {
            Graph g = new Graph(4);
            g.addEdge(0, 1, 10);
            g.addEdge(0, 3, 100);
            DSPEngine engine = new DSPEngine(g);
            engine.setSource(0);
            engine.getShortestPath(3);   // 100 via 0->3; establishes state
            engine.addEdge(1, 2, 1);     // pending
            engine.addEdge(2, 3, 1);     // pending
            PathResult r = engine.getShortestPath(3);
            assertTrue(r.isReachable());
            assertEquals(12, r.getDistance());  // 0->1->2->3 = 10+1+1
            assertEquals(List.of(0, 1, 2, 3), r.getPath());
        }
    }

    @Nested
    class GraphOnly {
        @Test
        void graphEdgeCrud() {
            Graph g = new Graph(3);
            assertTrue(g.addEdge(0, 1, 1));
            assertFalse(g.addEdge(0, 1, 2));  // duplicate
            assertEquals(1, g.getEdgeWeight(0, 1));
            assertEquals(-1, g.getEdgeWeight(1, 0));
            assertTrue(g.removeEdge(0, 1));
            assertEquals(-1, g.getEdgeWeight(0, 1));
            assertEquals(-1, g.setEdgeWeight(0, 1, 5));  // add
            assertEquals(5, g.getEdgeWeight(0, 1));
            assertEquals(5, g.setEdgeWeight(0, 1, 10));  // update
            assertEquals(10, g.getEdgeWeight(0, 1));
        }

        @Test
        void graphInEdges() {
            Graph g = new Graph(3);
            g.addEdge(0, 1, 2);
            g.addEdge(2, 1, 3);
            var in = g.getInEdges(1);
            assertEquals(2, in.size());
            assertTrue(in.stream().anyMatch(e -> e.getFrom() == 0 && e.getWeight() == 2));
            assertTrue(in.stream().anyMatch(e -> e.getFrom() == 2 && e.getWeight() == 3));
        }
    }
}
