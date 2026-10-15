
package sn.irrigation.backend;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IrrigationCommandRepository
        extends JpaRepository<IrrigationCommand, String> {

    Optional<IrrigationCommand>
        findFirstByStatusAndDeliveredAtIsNullOrderByCreatedAtAsc(
            String status
        );

    Page<IrrigationCommand>
        findAllByOrderByCreatedAtDesc(Pageable pageable);

    List<IrrigationCommand>
        findTop20ByOrderByCreatedAtDesc();
}
