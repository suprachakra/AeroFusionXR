import { BaggageTrackingService } from '../BaggageTrackingService';
import { BaggageEvent, BaggageEventType, BaggageStatus, Location } from '../../types';
import { metrics } from '../../utils/metrics';

describe('BaggageTrackingService', () => {
  let service: BaggageTrackingService;

  beforeEach(() => {
    service = new BaggageTrackingService(
      'redis://localhost:6379',
      'mqtt://localhost:1883'
    );
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('processEvent', () => {
    it('should process a valid baggage event', async () => {
      const event: BaggageEvent = {
        tagId: 'tag123',
        eventType: BaggageEventType.ZONE_ENTRY,
        location: {
          x: 100,
          y: 200,
          z: 0,
          zone: 'Terminal-A',
          terminal: 'T1',
          timestamp: new Date(),
          confidence: 0.95
        },
        timestamp: new Date(),
        metadata: {
          source: 'test'
        }
      };

      const mockTag = {
        id: 'tag123',
        flightNumber: 'AF123',
        passengerName: 'John Doe',
        origin: 'JFK',
        destination: 'LAX',
        weight: 23.5,
        taggedAt: new Date(),
        status: BaggageStatus.CHECKED_IN
      };

      // Mock Redis get to return a tag
      (service as any).redis.get.mockResolvedValue(JSON.stringify(mockTag));

      // Call private method using type assertion
      await (service as any).processEvent(event);

      // Verify Redis operations
      expect((service as any).redis.get).toHaveBeenCalledWith('baggage:tag:tag123');
      expect((service as any).redis.set).toHaveBeenCalled();
      expect((service as any).redis.zadd).toHaveBeenCalled();

      // Verify metrics
      expect(metrics.createHistogram).toHaveBeenCalled();
      expect(metrics.createGauge).toHaveBeenCalled();
    });

    it('should handle unknown tag events', async () => {
      const event: BaggageEvent = {
        tagId: 'unknown123',
        eventType: BaggageEventType.SCAN,
        location: {
          x: 0,
          y: 0,
          z: 0,
          zone: 'Unknown',
          terminal: 'T1',
          timestamp: new Date(),
          confidence: 0.5
        },
        timestamp: new Date()
      };

      // Mock Redis get to return null
      (service as any).redis.get.mockResolvedValue(null);

      // Call private method using type assertion
      await (service as any).processEvent(event);

      // Verify Redis was queried but no updates were made
      expect((service as any).redis.get).toHaveBeenCalledWith('baggage:tag:unknown123');
      expect((service as any).redis.set).not.toHaveBeenCalled();
      expect((service as any).redis.zadd).not.toHaveBeenCalled();
    });
  });

  describe('checkAlerts', () => {
    it('should generate alerts for stationary baggage', async () => {
      const tag = {
        id: 'tag123',
        status: BaggageStatus.IN_TRANSIT,
        lastLocation: {
          x: 100,
          y: 200,
          z: 0,
          zone: 'Terminal-A',
          terminal: 'T1',
          timestamp: new Date(Date.now() - 40 * 60 * 1000), // 40 minutes ago
          confidence: 0.95
        },
        lastUpdated: new Date(Date.now() - 40 * 60 * 1000)
      };

      const event: BaggageEvent = {
        tagId: 'tag123',
        eventType: BaggageEventType.SCAN,
        location: {
          x: 100,
          y: 200,
          z: 0,
          zone: 'Terminal-A',
          terminal: 'T1',
          timestamp: new Date(),
          confidence: 0.95
        },
        timestamp: new Date()
      };

      // Call private method using type assertion
      await (service as any).checkAlerts(tag, event);

      // Verify alert was stored
      expect((service as any).redis.zadd).toHaveBeenCalled();
      expect(metrics.increment).toHaveBeenCalledWith('baggage_alerts_total', {
        alert_type: 'STATIONARY',
        severity: 'MEDIUM'
      });
    });
  });

  describe('searchTags', () => {
    it('should search for tags with given criteria', async () => {
      const criteria = {
        flightNumber: 'AF123',
        status: BaggageStatus.IN_TRANSIT,
        zone: 'Terminal-A'
      };

      const mockTags = [
        {
          id: 'tag123',
          flightNumber: 'AF123',
          status: BaggageStatus.IN_TRANSIT,
          lastLocation: {
            zone: 'Terminal-A'
          }
        }
      ];

      // Mock implementation will be added when search is implemented
      const result = await service.searchTags(criteria);
      expect(Array.isArray(result)).toBeTruthy();
    });
  });

  describe('getTagHistory', () => {
    it('should retrieve tag event history', async () => {
      const tagId = 'tag123';
      const mockEvents = [
        JSON.stringify({
          tagId,
          eventType: BaggageEventType.SCAN,
          timestamp: new Date()
        })
      ];

      // Mock Redis zrange to return events
      (service as any).redis.zrange.mockResolvedValue(mockEvents);

      const history = await service.getTagHistory(tagId);
      expect(Array.isArray(history)).toBeTruthy();
      expect(history.length).toBe(1);
      expect(history[0].tagId).toBe(tagId);
    });
  });
}); 