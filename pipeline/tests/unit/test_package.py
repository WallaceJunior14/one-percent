import one_percent


def test_package_exposes_version() -> None:
    assert one_percent.__version__ == "0.1.0"
