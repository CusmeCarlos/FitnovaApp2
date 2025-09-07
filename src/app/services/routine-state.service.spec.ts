import { TestBed } from '@angular/core/testing';

import { RoutineStateService } from './routine-state.service';

describe('RoutineStateService', () => {
  let service: RoutineStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RoutineStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
