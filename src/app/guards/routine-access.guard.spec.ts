import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { routineAccessGuard } from './routine-access.guard';

describe('routineAccessGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => routineAccessGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
